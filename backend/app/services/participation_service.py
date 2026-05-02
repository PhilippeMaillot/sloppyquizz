from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.participation import ParticipationPublic, RoomResultsPublic
from app.models.user import UserPublic
from app.services.scoring_service import ScoringService
from app.services.leaderboard_service import LeaderboardService


class ParticipationService:
    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self.database = database
        self.rooms = database.rooms
        self.quizzes = database.quizzes
        self.participations = database.participations
        self.users = database.users
        self.scoring_service = ScoringService()

    async def finish_room_as_host(self, *, room_code: str, host_user_id: str) -> RoomResultsPublic:
        room = await self.rooms.find_one({"code": room_code.upper()})
        if room is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
        if str(room.get("hostId")) != host_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can finish the quiz"
            )

        if room.get("status") not in {"REVEAL_PHASE", "FINISHED"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Room is not ready to be finished",
            )

        quiz = await self.quizzes.find_one({"_id": room["quizId"]})
        if quiz is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

        # Idempotency: if already finished and participations saved, return existing results.
        if room.get("status") == "FINISHED" and room.get("participationsSavedAt") is not None:
            return await self.get_room_results(str(room["_id"]))

        players = list(room.get("players", []))
        answers = list(room.get("answers", []))
        if any((answer.get("validation") or {}).get("method", "none") != "manual" for answer in answers):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All submitted answers must be validated before finishing the quiz",
            )

        # Recalculate scores from host-validated answers.
        players = self.scoring_service.recalculate_player_scores(players, answers)

        ranking = self._build_ranking(players)
        participations_payload = self._build_participations(
            room=room,
            quiz=quiz,
            answers=answers,
            ranking=ranking,
        )

        now = datetime.now(timezone.utc)

        # Mark room finished first to prevent repeated saves; double protection via unique index.
        await self.rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "status": "FINISHED",
                    "players": players,
                    "finishedAt": now,
                    "updatedAt": now,
                    "participationsSavedAt": now,
                }
            },
        )

        for document, user_stats_delta in participations_payload:
            await self.participations.update_one(
                {"roomId": document["roomId"], "playerId": document["playerId"]},
                {"$setOnInsert": document},
                upsert=True,
            )
            if user_stats_delta is not None:
                await self.users.update_one(
                    {"_id": ObjectId(user_stats_delta["userId"])},
                    {"$inc": user_stats_delta["inc"]},
                )

        results = await self.get_room_results(str(room["_id"]))
        return results

    async def get_my_participations(self, current_user: UserPublic) -> list[ParticipationPublic]:
        cursor = self.participations.find({"userId": ObjectId(current_user.id)}).sort(
            "playedAt", -1
        )
        return [self._to_public(document) async for document in cursor]

    async def get_room_results(self, room_id: str) -> RoomResultsPublic:
        if not ObjectId.is_valid(room_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

        room = await self.rooms.find_one({"_id": ObjectId(room_id)})
        if room is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
        if room.get("status") != "FINISHED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Room is not finished yet",
            )

        quiz = await self.quizzes.find_one({"_id": room["quizId"]})
        quiz_title = quiz.get("title") if quiz else None

        cursor = self.participations.find({"roomId": ObjectId(room_id)}).sort(
            [("rank", 1), ("score", -1)]
        )
        results = [self._to_public(document) async for document in cursor]
        finished_at = room.get("finishedAt")
        if finished_at is None:
            finished_at = room.get("updatedAt") or datetime.now(timezone.utc)

        return RoomResultsPublic(
            roomId=str(room["_id"]),
            quizId=str(room["quizId"]),
            quizTitle=quiz_title,
            finishedAt=finished_at,
            results=results,
        )

    async def get_quiz_participations(
        self,
        quiz_id: str,
        current_user: UserPublic | None,
    ) -> list[ParticipationPublic]:
        if not ObjectId.is_valid(quiz_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

        quiz = await self.quizzes.find_one({"_id": ObjectId(quiz_id)})
        if quiz is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

        visibility = quiz.get("visibility", "private")
        if visibility != "public":
            if current_user is None or str(quiz.get("creatorId")) != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to view participations for this quiz",
                )

        cursor = self.participations.find({"quizId": ObjectId(quiz_id)}).sort("playedAt", -1)
        return [self._to_public(document) async for document in cursor]

    def _build_ranking(self, players: list[dict]) -> list[dict]:
        sorted_players = sorted(players, key=lambda player: float(player.get("score") or 0), reverse=True)

        ranking: list[dict] = []
        last_score: float | None = None
        last_rank = 0
        for index, player in enumerate(sorted_players):
            score = float(player.get("score") or 0)
            if last_score is None or score != last_score:
                last_rank = index + 1
                last_score = score
            ranking.append(
                {
                    "playerId": player.get("playerId"),
                    "userId": player.get("userId"),
                    "nickname": player.get("nickname"),
                    "score": score,
                    "rank": last_rank,
                }
            )
        return ranking

    def _build_participations(
        self,
        *,
        room: dict,
        quiz: dict,
        answers: list[dict],
        ranking: list[dict],
    ) -> list[tuple[dict, dict | None]]:
        quiz_title = quiz.get("title")
        quiz_cover_image_url = quiz.get("coverImageUrl")
        room_id = room["_id"]
        quiz_id = room["quizId"]
        now = datetime.now(timezone.utc)

        validated_answers = [
            answer
            for answer in answers
            if (answer.get("validation") or {}).get("method", "none") == "manual"
        ]

        by_player: dict[str, list[dict]] = {}
        for answer in validated_answers:
            player_id = answer.get("playerId")
            if isinstance(player_id, str) and player_id:
                by_player.setdefault(player_id, []).append(answer)

        payloads: list[tuple[dict, dict | None]] = []
        for entry in ranking:
            player_id = entry.get("playerId")
            if not isinstance(player_id, str) or not player_id:
                continue

            player_answers = by_player.get(player_id, [])
            correct_count = len([a for a in player_answers if a.get("isCorrect") is True])
            user_id = entry.get("userId")

            document = {
                "quizId": quiz_id,
                "quizTitle": quiz_title,
                "quizCoverImageUrl": quiz_cover_image_url,
                "roomId": room_id,
                "playerId": player_id,
                "userId": ObjectId(user_id) if isinstance(user_id, str) and ObjectId.is_valid(user_id) else None,
                "nickname": entry.get("nickname") or "Player",
                "score": float(entry.get("score") or 0),
                "rank": int(entry.get("rank") or 0),
                "correctAnswersCount": correct_count,
                "answers": player_answers,
                "playedAt": now,
            }

            user_stats_delta: dict | None = None
            if document["userId"] is not None:
                inc = {
                    "stats.totalPoints": document["score"],
                    "stats.quizzesPlayed": 1,
                }
                if document["rank"] == 1:
                    inc["stats.wins"] = 1
                user_stats_delta = {"userId": str(document["userId"]), "inc": inc}

            payloads.append((document, user_stats_delta))
        return payloads

    def _to_public(self, document: dict) -> ParticipationPublic:
        return ParticipationPublic(
            id=str(document["_id"]),
            quizId=str(document["quizId"]),
            quizTitle=document.get("quizTitle"),
            quizCoverImageUrl=document.get("quizCoverImageUrl"),
            roomId=str(document["roomId"]),
            playerId=document.get("playerId"),
            userId=str(document["userId"]) if document.get("userId") is not None else None,
            nickname=document.get("nickname", "Player"),
            score=float(document.get("score") or 0),
            rank=int(document.get("rank") or 0),
            correctAnswersCount=int(document.get("correctAnswersCount") or 0),
            answers=list(document.get("answers", [])),
            playedAt=document.get("playedAt"),
        )

