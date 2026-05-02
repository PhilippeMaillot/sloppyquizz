from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
import socketio

from app.utils.ids import generate_id
from app.services.scoring_service import ScoringService
from app.services.participation_service import ParticipationService


class RoomManager:
    def __init__(self) -> None:
        self.sid_to_player: dict[str, tuple[str, str]] = {}
        self.sid_to_user_id: dict[str, str] = {}
        self.scoring_service = ScoringService()
        self.participation_service: ParticipationService | None = None

    def set_authenticated_user(self, sid: str, user_id: str) -> None:
        self.sid_to_user_id[sid] = user_id

    def get_authenticated_user_id(self, sid: str) -> str | None:
        return self.sid_to_user_id.get(sid)

    def clear_connection(self, sid: str) -> tuple[str, str] | None:
        self.sid_to_user_id.pop(sid, None)
        return self.sid_to_player.pop(sid, None)

    async def host_join_room(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        await sio.enter_room(sid, room["code"])
        state = self._build_room_state(room, quiz)
        await sio.emit("room:state_updated", state, to=sid)
        if room.get("status") == "QUESTION_ACTIVE" and quiz.get("slides"):
            await sio.emit("quiz:slide_started", self._build_slide_payload(room, quiz), to=sid)
        if room.get("status") == "REVEAL_PHASE" and quiz.get("slides"):
            await sio.emit("quiz:slide_revealed", self._build_reveal_payload(room, quiz), to=sid)
        return state

    async def player_join_room(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
        nickname: str,
        user_id: str | None = None,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        clean_nickname = nickname.strip()[:40]
        if not clean_nickname:
            raise ValueError("Nickname is required")

        now = datetime.now(timezone.utc)
        # If the client is authenticated, try to find an existing player
        # for this user and mark them connected instead of creating a new one.
        existing_player_id: str | None = None
        if user_id is not None:
            for p in room.get("players", []):
                if p.get("userId") is not None and str(p.get("userId")) == str(user_id):
                    existing_player_id = p.get("playerId")
                    break

        if existing_player_id is not None:
            # Reuse the existing player entry: set connected True and update nickname.
            await database.rooms.update_one(
                {"_id": room["_id"], "players.playerId": existing_player_id},
                {
                    "$set": {
                        "players.$.connected": True,
                        "players.$.nickname": clean_nickname,
                        "updatedAt": now,
                    }
                },
            )
            updated_room, quiz = await self._get_room_and_quiz(database, room_code)
            self.sid_to_player[sid] = (updated_room["code"], existing_player_id)
            await sio.enter_room(sid, updated_room["code"])

            state = self._build_room_state(updated_room, quiz)
            # find the up-to-date player object
            player_obj = next((pl for pl in updated_room.get("players", []) if pl.get("playerId") == existing_player_id), None)
            player_payload = {
                **(player_obj or {}),
                "joinedAt": (player_obj.get("joinedAt") if player_obj else now).isoformat(),
            }
            await sio.emit("room:player_joined", player_payload, room=updated_room["code"])
            await sio.emit("room:state_updated", state, room=updated_room["code"])
        else:
            # No existing player for this user: create a new player entry.
            player_id = generate_id("player")
            player = {
                "playerId": player_id,
                "userId": user_id,
                "nickname": clean_nickname,
                "avatarUrl": None,
                "score": 0,
                "connected": True,
                "joinedAt": now,
            }

            await database.rooms.update_one(
                {"_id": room["_id"]},
                {
                    "$push": {"players": player},
                    "$set": {"updatedAt": now},
                },
            )
            updated_room, quiz = await self._get_room_and_quiz(database, room_code)
            self.sid_to_player[sid] = (updated_room["code"], player_id)
            await sio.enter_room(sid, updated_room["code"])

            state = self._build_room_state(updated_room, quiz)
            player_payload = {
                **player,
                "joinedAt": player["joinedAt"].isoformat(),
            }
            await sio.emit("room:player_joined", player_payload, room=updated_room["code"])
            await sio.emit("room:state_updated", state, room=updated_room["code"])

        if updated_room.get("status") == "QUESTION_ACTIVE":
            slide_payload = self._build_slide_payload(updated_room, quiz)
            await sio.emit("quiz:slide_started", slide_payload, to=sid)
        if updated_room.get("status") == "REVEAL_PHASE":
            reveal_payload = self._build_reveal_payload(updated_room, quiz)
            await sio.emit("quiz:slide_revealed", reveal_payload, to=sid)

        return {
            "player": player_payload,
            "room": state,
        }

    async def player_rejoin_room(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
        player_id: str,
        user_id: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)

        player = next(
            (p for p in room.get("players", []) if p.get("playerId") == player_id),
            None,
        )
        if player is None:
            raise ValueError("Player session not found for this room")

        # Prevent hijacking: the stored player must belong to the authenticated user.
        if player.get("userId") is None or str(player.get("userId")) != user_id:
            raise PermissionError("Player does not belong to this user")

        now = datetime.now(timezone.utc)
        await database.rooms.update_one(
            {"_id": room["_id"], "players.playerId": player_id},
            {"$set": {"players.$.connected": True, "updatedAt": now}},
        )

        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        self.sid_to_player[sid] = (updated_room["code"], player_id)
        await sio.enter_room(sid, updated_room["code"])

        state = self._build_room_state(updated_room, quiz)
        await sio.emit("room:state_updated", state, to=sid)

        status = updated_room.get("status")
        slides = quiz.get("slides", [])

        if status in {"QUESTION_ACTIVE", "QUESTION_LOCKED"} and slides:
            slide_payload = self._build_slide_payload(updated_room, quiz)
            await sio.emit("quiz:slide_started", slide_payload, to=sid)
            if status == "QUESTION_LOCKED":
                await sio.emit(
                    "quiz:answers_locked",
                    self._build_answers_count_payload(updated_room, quiz),
                    to=sid,
                )

            # If this player has already answered the current slide, re-send their answer.
            current_slide_id = slide_payload.get("slide", {}).get("id")
            existing = next(
                (
                    a
                    for a in updated_room.get("answers", [])
                    if a.get("playerId") == player_id and a.get("slideId") == current_slide_id
                ),
                None,
            )
            if isinstance(existing, dict):
                await sio.emit("quiz:answer_received", self._serialize_answer_for_player(existing), to=sid)

        if status == "REVEAL_PHASE" and slides:
            reveal_payload = self._build_reveal_payload(updated_room, quiz)
            await sio.emit("quiz:slide_revealed", reveal_payload, to=sid)

        return {"ok": True, "room": state}

    async def player_leave_room(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
    ) -> None:
        player_ref = self.sid_to_player.pop(sid, None)
        if player_ref is None:
            return

        room_code, player_id = player_ref
        now = datetime.now(timezone.utc)
        await database.rooms.update_one(
            {"code": room_code, "players.playerId": player_id},
            {
                "$set": {
                    "players.$.connected": False,
                    "updatedAt": now,
                }
            },
        )
        room, quiz = await self._get_room_and_quiz(database, room_code)
        await sio.emit(
            "room:player_left",
            {"playerId": player_id},
            room=room_code,
        )
        await sio.emit(
            "room:state_updated",
            self._build_room_state(room, quiz),
            room=room_code,
        )

    async def start_quiz(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        if room.get("status") != "WAITING_ROOM":
            raise ValueError("Quiz has already started")
        if not quiz.get("slides"):
            raise ValueError("This quiz has no slides")

        now = datetime.now(timezone.utc)
        await database.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "status": "QUESTION_ACTIVE",
                    "currentSlideIndex": 0,
                    "updatedAt": now,
                }
            },
        )
        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        state = self._build_room_state(updated_room, quiz)
        slide_payload = self._build_slide_payload(updated_room, quiz)
        await sio.emit("room:state_updated", state, room=updated_room["code"])
        await sio.emit("quiz:slide_started", slide_payload, room=updated_room["code"])
        await self._emit_answers_count(sio, updated_room, quiz)
        return slide_payload

    async def next_slide(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        if room.get("status") not in ("QUESTION_ACTIVE", "QUESTION_LOCKED"):
            raise ValueError("Quiz is not in question phase")
        slides = quiz.get("slides", [])
        if not slides:
            raise ValueError("This quiz has no slides")

        next_index = int(room.get("currentSlideIndex", 0)) + 1
        if next_index >= len(slides):
            raise ValueError("Already on last slide")

        now = datetime.now(timezone.utc)
        await database.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "status": "QUESTION_ACTIVE",
                    "currentSlideIndex": next_index,
                    "updatedAt": now,
                    "finishedAt": None,
                }
            },
        )
        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        state = self._build_room_state(updated_room, quiz)
        await sio.emit("room:state_updated", state, room=updated_room["code"])

        slide_payload = self._build_slide_payload(updated_room, quiz)
        await sio.emit(
            "quiz:slide_started",
            slide_payload,
            room=updated_room["code"],
        )
        await self._emit_answers_count(sio, updated_room, quiz)
        return slide_payload

    async def prev_slide(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        if room.get("status") not in ("QUESTION_ACTIVE", "QUESTION_LOCKED"):
            raise ValueError("Quiz is not in question phase")
        slides = quiz.get("slides", [])
        if not slides:
            raise ValueError("This quiz has no slides")

        prev_index = int(room.get("currentSlideIndex", 0)) - 1
        if prev_index < 0:
            raise ValueError("Already on first slide")

        now = datetime.now(timezone.utc)
        await database.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "status": "QUESTION_ACTIVE",
                    "currentSlideIndex": prev_index,
                    "updatedAt": now,
                    "finishedAt": None,
                }
            },
        )
        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        state = self._build_room_state(updated_room, quiz)
        slide_payload = self._build_slide_payload(updated_room, quiz)
        await sio.emit("room:state_updated", state, room=updated_room["code"])
        await sio.emit("quiz:slide_started", slide_payload, room=updated_room["code"])
        await self._emit_answers_count(sio, updated_room, quiz)
        return slide_payload

    async def submit_answer(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
        slide_id: str,
        player_id: str,
        answer: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        if room.get("status") != "QUESTION_ACTIVE":
            raise ValueError("Answers are not open for this room")

        slides = quiz.get("slides", [])
        current_index = int(room.get("currentSlideIndex", 0))
        if current_index >= len(slides):
            raise ValueError("Current slide not found")

        current_slide = slides[current_index]
        if current_slide.get("id") != slide_id:
            raise ValueError("Answer does not match the current slide")

        room_ref = self.sid_to_player.get(sid)
        if room_ref is None or room_ref != (room["code"], player_id):
            raise PermissionError("Player is not connected to this room")

        player = next(
            (
                player
                for player in room.get("players", [])
                if player.get("playerId") == player_id
            ),
            None,
        )
        if player is None:
            raise PermissionError("Player does not belong to this room")

        if any(
            saved_answer.get("slideId") == slide_id
            and saved_answer.get("playerId") == player_id
            for saved_answer in room.get("answers", [])
        ):
            raise ValueError("Player has already answered this slide")

        self._validate_answer_for_slide(current_slide, answer)

        now = datetime.now(timezone.utc)
        submitted_answer = {
            "answerId": generate_id("answer"),
            "roomId": str(room["_id"]),
            "quizId": str(room["quizId"]),
            "slideId": slide_id,
            "playerId": player_id,
            "userId": player.get("userId"),
            "answer": answer,
            "submittedAt": now,
            "isCorrect": None,
            "pointsAwarded": 0,
            "validation": {
                "method": "none",
                "confidence": None,
                "reason": None,
                "validatedBy": None,
            },
        }

        await database.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$push": {"answers": submitted_answer},
                "$set": {"updatedAt": now},
            },
        )
        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        count_payload = self._build_answers_count_payload(updated_room, quiz)
        answer_payload = self._serialize_answer_for_player(submitted_answer)
        await sio.emit("quiz:answer_received", answer_payload, to=sid)
        await sio.emit(
            "quiz:answer_submitted",
            {"slideId": slide_id, "playerId": player_id},
            room=room["code"],
            skip_sid=sid,
        )
        await sio.emit(
            "quiz:answers_count_updated",
            count_payload,
            room=room["code"],
        )
        return {
            "answer": answer_payload,
            "answersCount": count_payload,
        }

    async def lock_answers(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        if room.get("status") != "QUESTION_ACTIVE":
            raise ValueError("Only an active question can be locked")

        now = datetime.now(timezone.utc)
        await database.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "status": "QUESTION_LOCKED",
                    "updatedAt": now,
                }
            },
        )
        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        state = self._build_room_state(updated_room, quiz)
        count_payload = self._build_answers_count_payload(updated_room, quiz)
        await sio.emit("room:state_updated", state, room=updated_room["code"])
        await sio.emit("quiz:answers_locked", count_payload, room=updated_room["code"])
        return count_payload

    async def start_reveal(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        slides = quiz.get("slides", [])
        if not slides:
            raise ValueError("This quiz has no slides")
        if room.get("status") not in {"QUESTION_ACTIVE", "QUESTION_LOCKED"}:
            raise ValueError("Last question must be active before starting reveal")
        current_index = int(room.get("currentSlideIndex", 0))
        if current_index != len(slides) - 1:
            raise ValueError("Reveal can only start after the last question")

        now = datetime.now(timezone.utc)
        await database.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "status": "REVEAL_PHASE",
                    "revealSlideIndex": 0,
                    "updatedAt": now,
                    "finishedAt": None,
                }
            },
        )
        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        state = self._build_room_state(updated_room, quiz)
        reveal_payload = self._build_reveal_payload(updated_room, quiz)

        await sio.emit("room:state_updated", state, room=updated_room["code"])
        await sio.emit("quiz:reveal_started", state, room=updated_room["code"])
        await sio.emit("quiz:slide_revealed", reveal_payload, room=updated_room["code"])
        return reveal_payload

    async def reveal_slide(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        if room.get("status") != "REVEAL_PHASE":
            raise ValueError("Reveal phase has not started")

        reveal_payload = self._build_reveal_payload(room, quiz)
        await sio.emit("quiz:slide_revealed", reveal_payload, room=room["code"])
        return reveal_payload

    async def next_reveal_slide(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        if room.get("status") != "REVEAL_PHASE":
            raise ValueError("Reveal phase has not started")

        slides = quiz.get("slides", [])
        if not slides:
            raise ValueError("This quiz has no slides")

        current_reveal_index = int(room.get("revealSlideIndex", 0))
        current_slide = slides[current_reveal_index] if current_reveal_index < len(slides) else None
        current_slide_id = current_slide.get("id") if isinstance(current_slide, dict) else None
        if any(
            answer.get("slideId") == current_slide_id
            and (answer.get("validation") or {}).get("method", "none") != "manual"
            for answer in room.get("answers", [])
        ):
            raise ValueError("All submitted answers must be validated before moving on")

        next_index = current_reveal_index + 1
        now = datetime.now(timezone.utc)
        if next_index >= len(slides):
            await database.rooms.update_one(
                {"_id": room["_id"]},
                {
                    "$set": {
                        "status": "FINISHED",
                        "revealSlideIndex": len(slides) - 1,
                        "updatedAt": now,
                        "finishedAt": now,
                    }
                },
            )
            updated_room, quiz = await self._get_room_and_quiz(database, room_code)
            state = self._build_room_state(updated_room, quiz)
            await sio.emit("room:state_updated", state, room=updated_room["code"])
            await sio.emit("quiz:reveal_finished", state, room=updated_room["code"])
            # Auto-finish: persist results and redirect everyone to /results via quiz:finished.
            finish_payload = await self.finish_quiz(sio, database, sid, room_code)
            return {"finished": True, "room": state, "results": finish_payload.get("results")}

        await database.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "revealSlideIndex": next_index,
                    "updatedAt": now,
                }
            },
        )
        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        state = self._build_room_state(updated_room, quiz)
        reveal_payload = self._build_reveal_payload(updated_room, quiz)
        await sio.emit("room:state_updated", state, room=updated_room["code"])
        await sio.emit("quiz:slide_revealed", reveal_payload, room=updated_room["code"])
        return reveal_payload

    async def prev_reveal_slide(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        if room.get("status") != "REVEAL_PHASE":
            raise ValueError("Reveal phase has not started")

        slides = quiz.get("slides", [])
        if not slides:
            raise ValueError("This quiz has no slides")

        prev_index = int(room.get("revealSlideIndex", 0)) - 1
        if prev_index < 0:
            raise ValueError("Already on first reveal slide")

        now = datetime.now(timezone.utc)
        await database.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "revealSlideIndex": prev_index,
                    "updatedAt": now,
                }
            },
        )
        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        state = self._build_room_state(updated_room, quiz)
        reveal_payload = self._build_reveal_payload(updated_room, quiz)
        await sio.emit("room:state_updated", state, room=updated_room["code"])
        await sio.emit("quiz:slide_revealed", reveal_payload, room=updated_room["code"])
        return reveal_payload

    async def validate_reveal_slide(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        if room.get("status") != "REVEAL_PHASE":
            raise ValueError("Reveal phase has not started")

        slides = quiz.get("slides", [])
        reveal_index = int(room.get("revealSlideIndex", 0))
        if reveal_index >= len(slides):
            raise ValueError("Reveal slide not found")

        slide = slides[reveal_index]
        slide_id = slide.get("id")
        if not isinstance(slide_id, str) or not slide_id:
            raise ValueError("Slide id is missing")

        updated_answers: list[dict] = []
        changed_answers: list[dict] = []
        for answer in room.get("answers", []):
            if answer.get("slideId") != slide_id:
                updated_answers.append(answer)
                continue

            current_method = (answer.get("validation") or {}).get("method", "none")
            if current_method == "manual":
                updated_answers.append(answer)
                continue

            updated = await self._mark_answer_for_manual_validation(answer)
            updated_answers.append(updated)
            changed_answers.append(updated)

        updated_players = self.scoring_service.recalculate_player_scores(
            list(room.get("players", [])),
            updated_answers,
        )

        now = datetime.now(timezone.utc)
        await database.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "answers": updated_answers,
                    "players": updated_players,
                    "updatedAt": now,
                }
            },
        )

        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        state = self._build_room_state(updated_room, quiz)
        reveal_payload = self._build_reveal_payload(updated_room, quiz)

        await sio.emit("room:state_updated", state, room=updated_room["code"])

        score_payload = {
            "roomCode": updated_room["code"],
            "players": [
                {
                    "playerId": player.get("playerId"),
                    "nickname": player.get("nickname"),
                    "score": player.get("score", 0),
                }
                for player in state.get("players", [])
            ],
        }
        await sio.emit("quiz:score_updated", score_payload, room=updated_room["code"])

        for changed in changed_answers:
            await sio.emit(
                "quiz:answer_validation_updated",
                self._serialize_answer_for_reveal(changed, updated_room),
                room=updated_room["code"],
            )

        await sio.emit(
            "quiz:slide_points_validated",
            {
                "roomCode": updated_room["code"],
                "slideId": slide_id,
                "revealSlideIndex": reveal_index,
            },
            room=updated_room["code"],
        )

        await sio.emit("quiz:slide_revealed", reveal_payload, room=updated_room["code"])
        return {"ok": True, "reveal": reveal_payload, "scores": score_payload}

    async def _mark_answer_for_manual_validation(self, answer: dict) -> dict:
        def merge_validation(patch: dict) -> dict:
            return {**(answer.get("validation") or {}), **patch}

        return {
            **answer,
            "isCorrect": None,
            "pointsAwarded": 0,
            "validation": merge_validation(
                {
                    "method": "manual_required",
                    "confidence": None,
                    "reason": "Validation manuelle requise par le host.",
                    "validatedBy": None,
                }
            ),
        }

    async def override_answer_validation(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
        answer_id: str,
        is_correct: bool,
        points_awarded: float | None = None,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        if room.get("status") != "REVEAL_PHASE":
            raise ValueError("Reveal phase has not started")

        slides = quiz.get("slides", [])
        slide_by_id = {slide.get("id"): slide for slide in slides}

        host_id = self.sid_to_user_id.get(sid)
        if host_id is None:
            raise PermissionError("Host is not authenticated")

        updated_answers: list[dict] = []
        updated_target: dict | None = None
        for answer in room.get("answers", []):
            if answer.get("answerId") != answer_id:
                updated_answers.append(answer)
                continue

            slide_id = answer.get("slideId")
            slide = slide_by_id.get(slide_id)
            if not isinstance(slide, dict):
                raise ValueError("Slide not found for this answer")

            result = self.scoring_service.apply_manual_override(
                slide,
                answer,
                is_correct=bool(is_correct),
                host_id=host_id,
                points_awarded=points_awarded,
            )
            updated = {
                **answer,
                "isCorrect": result.is_correct,
                "pointsAwarded": result.points_awarded,
                "validation": {
                    **(answer.get("validation") or {}),
                    **result.validation,
                },
            }
            updated_target = updated
            updated_answers.append(updated)

        if updated_target is None:
            raise ValueError("Answer not found")

        updated_players = self.scoring_service.recalculate_player_scores(
            list(room.get("players", [])),
            updated_answers,
        )

        now = datetime.now(timezone.utc)
        await database.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "answers": updated_answers,
                    "players": updated_players,
                    "updatedAt": now,
                }
            },
        )

        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        state = self._build_room_state(updated_room, quiz)
        reveal_payload = self._build_reveal_payload(updated_room, quiz)

        await sio.emit("room:state_updated", state, room=updated_room["code"])

        score_payload = {
            "roomCode": updated_room["code"],
            "players": [
                {
                    "playerId": player.get("playerId"),
                    "nickname": player.get("nickname"),
                    "score": player.get("score", 0),
                }
                for player in state.get("players", [])
            ],
        }
        await sio.emit("quiz:score_updated", score_payload, room=updated_room["code"])

        await sio.emit(
            "quiz:answer_validation_updated",
            self._serialize_answer_for_reveal(updated_target, updated_room),
            room=updated_room["code"],
        )
        await sio.emit("quiz:slide_revealed", reveal_payload, room=updated_room["code"])
        return {"ok": True}

    async def finish_quiz(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, _quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)
        if any(
            (answer.get("validation") or {}).get("method", "none") != "manual"
            for answer in room.get("answers", [])
        ):
            raise ValueError("All submitted answers must be validated before finishing the quiz")

        host_id = self.sid_to_user_id.get(sid)
        if host_id is None:
            raise PermissionError("Host is not authenticated")

        service = self.participation_service or ParticipationService(database)
        self.participation_service = service

        results = await service.finish_room_as_host(room_code=room_code, host_user_id=host_id)
        await sio.emit(
            "quiz:finished",
            results.model_dump(mode="json"),
            room=room_code,
        )
        return {"ok": True, "results": results.model_dump(mode="json")}

    async def reset_session(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)

        now = datetime.now(timezone.utc)

        # Reset scores but keep the same players list (and connections).
        reset_players: list[dict] = []
        for player in list(room.get("players", [])):
            reset_players.append({**player, "score": 0})

        await database.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "status": "WAITING_ROOM",
                    "currentSlideIndex": 0,
                    "revealSlideIndex": 0,
                    "answers": [],
                    "players": reset_players,
                    "updatedAt": now,
                    "finishedAt": None,
                    "participationsSavedAt": None,
                }
            },
        )

        # Allow saving results again for this room by clearing existing participations.
        await database.participations.delete_many({"roomId": room["_id"]})

        updated_room, quiz = await self._get_room_and_quiz(database, room_code)
        state = self._build_room_state(updated_room, quiz)
        await sio.emit("room:state_updated", state, room=updated_room["code"])
        await self._emit_answers_count(sio, updated_room, quiz)
        return {"ok": True, "room": state}

    async def audio_control(
        self,
        sio: socketio.AsyncServer,
        database: AsyncIOMotorDatabase,
        sid: str,
        room_code: str,
        *,
        action: str,
        position: float,
    ) -> dict:
        room, quiz = await self._get_room_and_quiz(database, room_code)
        self._ensure_host(room, sid)

        slides = quiz.get("slides", [])
        index = int(room.get("currentSlideIndex", 0))
        slide = slides[index] if 0 <= index < len(slides) else None
        audio = slide.get("audio") if isinstance(slide, dict) else None
        stored = audio.get("storedFileUrl") if isinstance(audio, dict) else None
        if not isinstance(stored, str) or not stored:
            raise ValueError("This slide has no audio to control")

        if action not in {"play", "pause", "seek"}:
            raise ValueError("Invalid audio action")

        payload = {
            "roomCode": room["code"],
            "action": action,
            "position": float(position),
            "sentAt": datetime.now(timezone.utc).timestamp(),
            "slideId": slide.get("id"),
            "audioUrl": stored,
        }
        await sio.emit("quiz:audio_control", payload, room=room["code"])
        return {"ok": True}

    async def _get_room_and_quiz(
        self,
        database: AsyncIOMotorDatabase,
        room_code: str,
    ) -> tuple[dict, dict]:
        room = await database.rooms.find_one({"code": room_code.upper()})
        if room is None:
            raise ValueError("Room not found")

        snapshot = room.get("quizSnapshot")
        if isinstance(snapshot, dict) and snapshot.get("slides") is not None:
            quiz = snapshot
        else:
            quiz = await database.quizzes.find_one({"_id": room["quizId"]})
            if quiz is None:
                raise ValueError("Quiz not found")

        return room, quiz

    def _ensure_host(self, room: dict, sid: str) -> None:
        user_id = self.sid_to_user_id.get(sid)
        if user_id is None or str(room["hostId"]) != user_id:
            raise PermissionError("Only the host can perform this action")

    def _build_room_state(self, room: dict, quiz: dict) -> dict:
        return {
            "id": str(room["_id"]),
            "quizId": str(room["quizId"]),
            "hostId": str(room["hostId"]),
            "code": room["code"],
            "status": room.get("status", "WAITING_ROOM"),
            "currentSlideIndex": room.get("currentSlideIndex", 0),
            "revealSlideIndex": room.get("revealSlideIndex", 0),
            "players": [
                {
                    "playerId": player["playerId"],
                    "userId": player.get("userId"),
                    "nickname": player["nickname"],
                    "avatarUrl": player.get("avatarUrl"),
                    "score": player.get("score", 0),
                    "connected": player.get("connected", True),
                    "joinedAt": player["joinedAt"].isoformat(),
                }
                for player in room.get("players", [])
            ],
            "quizTitle": quiz.get("title"),
            "totalSlides": len(quiz.get("slides", [])),
            "answersCount": self._build_answers_count_payload(room, quiz)[
                "answersReceived"
            ],
        }

    def _build_slide_payload(self, room: dict, quiz: dict) -> dict:
        slides = quiz.get("slides", [])
        index = room.get("currentSlideIndex", 0)
        slide = slides[index]
        return {
            "slide": self._sanitize_slide_for_players(slide),
            "currentSlideIndex": index,
            "totalSlides": len(slides),
        }

    def _build_reveal_payload(self, room: dict, quiz: dict) -> dict:
        slides = quiz.get("slides", [])
        reveal_index = int(room.get("revealSlideIndex", 0))
        if reveal_index >= len(slides):
            raise ValueError("Reveal slide not found")

        slide = slides[reveal_index]
        slide_id = slide.get("id")
        answers = [
            self._serialize_answer_for_reveal(answer, room)
            for answer in room.get("answers", [])
            if answer.get("slideId") == slide_id
        ]
        return {
            "roomCode": room["code"],
            "slide": self._serialize_slide_for_reveal(slide),
            "revealSlideIndex": reveal_index,
            "totalSlides": len(slides),
            "answers": answers,
            "correctAnswer": self._build_correct_answer(slide),
            "validationState": {
                "totalAnswers": len(answers),
                "validatedAnswers": len(
                    [
                        answer
                        for answer in answers
                        if answer.get("validation", {}).get("method") == "manual"
                    ]
                ),
            },
        }

    def _serialize_slide_for_reveal(self, slide: dict) -> dict:
        return {
            "id": slide.get("id"),
            "type": slide.get("type"),
            "title": slide.get("title"),
            "question": slide.get("question"),
            "description": slide.get("description"),
            "imageUrl": slide.get("imageUrl"),
            "elements": slide.get("elements"),
            "points": slide.get("points"),
            "backgroundColor": slide.get("backgroundColor"),
            "answerMode": slide.get("answerMode"),
            "audio": slide.get("audio"),
            "answers": [
                {
                    "id": answer.get("id"),
                    "text": answer.get("text"),
                    "isCorrect": answer.get("isCorrect", False),
                }
                for answer in slide.get("answers", [])
            ],
        }

    def _build_correct_answer(self, slide: dict) -> dict:
        slide_type = slide.get("type")
        return {"type": slide_type}

    def _sanitize_slide_for_players(self, slide: dict) -> dict:
        safe_slide = {
            key: value
            for key, value in slide.items()
            if key
            not in {
                "expectedAnswer",
                "manualValidationRequired",
            }
        }

        if "answers" in safe_slide:
            safe_slide["answers"] = [
                {"id": answer.get("id"), "text": answer.get("text")}
                for answer in safe_slide.get("answers", [])
            ]

        return safe_slide

    def _validate_answer_for_slide(self, slide: dict, answer: str) -> None:
        slide_type = slide.get("type")
        answer_ids = {choice.get("id") for choice in slide.get("answers", [])}
        if not isinstance(answer, str):
            raise ValueError("Answer must be a string")

        if slide_type == "single_choice":
            if answer not in answer_ids:
                raise ValueError("Invalid single choice answer")
            return

        if slide_type == "text_answer":
            if not answer.strip():
                raise ValueError("Invalid text answer")
            return

        if slide_type == "blind_test":
            answer_mode = slide.get("answerMode", "text")
            if answer_mode == "text":
                if not answer.strip():
                    raise ValueError("Invalid blind test text answer")
                return
            if answer_mode == "single_choice":
                if answer not in answer_ids:
                    raise ValueError("Invalid blind test single choice answer")
                return
            raise ValueError("Unsupported blind test answerMode")

        if slide_type == "true_false":
            if answer.strip().lower() not in {
                "true",
                "false",
                "vrai",
                "faux",
                "1",
                "0",
                "yes",
                "no",
            }:
                raise ValueError("Invalid true/false answer")
            return

        raise ValueError("Unsupported slide type")

    def _build_answers_count_payload(self, room: dict, quiz: dict) -> dict:
        slides = quiz.get("slides", [])
        current_index = int(room.get("currentSlideIndex", 0))
        slide_id = slides[current_index].get("id") if current_index < len(slides) else None
        answered_players = {
            answer.get("playerId")
            for answer in room.get("answers", [])
            if answer.get("slideId") == slide_id
        }
        connected_players = [
            player for player in room.get("players", []) if player.get("connected", True)
        ]
        return {
            "roomCode": room["code"],
            "slideId": slide_id,
            "answersReceived": len(answered_players),
            "playersCount": len(connected_players),
            "currentSlideIndex": current_index,
            "answeredPlayerIds": [pid for pid in answered_players if isinstance(pid, str)],
        }

    async def _emit_answers_count(
        self,
        sio: socketio.AsyncServer,
        room: dict,
        quiz: dict,
    ) -> None:
        await sio.emit(
            "quiz:answers_count_updated",
            self._build_answers_count_payload(room, quiz),
            room=room["code"],
        )

    def _serialize_answer_for_player(self, answer: dict) -> dict:
        serialized = {
            "answerId": answer.get("answerId"),
            "roomId": answer.get("roomId"),
            "quizId": answer.get("quizId"),
            "slideId": answer.get("slideId"),
            "playerId": answer.get("playerId"),
            "userId": answer.get("userId"),
            "answer": answer.get("answer"),
            "submittedAt": answer.get("submittedAt"),
        }
        submitted_at = serialized.get("submittedAt")
        if hasattr(submitted_at, "isoformat"):
            serialized["submittedAt"] = submitted_at.isoformat()
        return serialized

    def _serialize_answer_for_reveal(self, answer: dict, room: dict) -> dict:
        player = next(
            (
                player
                for player in room.get("players", [])
                if player.get("playerId") == answer.get("playerId")
            ),
            {},
        )
        serialized = {
            "answerId": answer.get("answerId"),
            "roomId": answer.get("roomId"),
            "quizId": answer.get("quizId"),
            "slideId": answer.get("slideId"),
            "playerId": answer.get("playerId"),
            "nickname": player.get("nickname", "Unknown player"),
            "userId": answer.get("userId"),
            "answer": answer.get("answer"),
            "submittedAt": answer.get("submittedAt"),
            "isCorrect": answer.get("isCorrect"),
            "pointsAwarded": answer.get("pointsAwarded", 0),
            "validation": answer.get("validation", {"method": "none"}),
        }
        submitted_at = serialized.get("submittedAt")
        if hasattr(submitted_at, "isoformat"):
            serialized["submittedAt"] = submitted_at.isoformat()
        return serialized


room_manager = RoomManager()
