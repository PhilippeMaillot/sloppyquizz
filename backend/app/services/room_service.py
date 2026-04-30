from datetime import datetime, timezone
import random
import string

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.models.room import RoomCreate, RoomInvitePublic, RoomPlayer, RoomPublic
from app.models.user import UserPublic


class RoomService:
    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self.database = database
        self.rooms = database.rooms
        self.quizzes = database.quizzes
        self.users = database.users

    async def create_room(self, payload: RoomCreate, host: UserPublic) -> RoomPublic:
        quiz = await self._get_owned_quiz(payload.quizId, host)
        now = datetime.now(timezone.utc)
        quiz_snapshot = {
            "id": str(quiz["_id"]),
            "title": quiz.get("title"),
            "slides": quiz.get("slides", []),
            "settings": quiz.get("settings", {}),
            "updatedAt": quiz.get("updatedAt"),
        }

        for _ in range(10):
            code = self._generate_room_code()
            document = {
                "quizId": quiz["_id"],
                "quizSnapshot": quiz_snapshot,
                "hostId": ObjectId(host.id),
                "code": code,
                "status": "WAITING_ROOM",
                "currentSlideIndex": 0,
                "revealSlideIndex": 0,
                "players": [],
                "answers": [],
                "createdAt": now,
                "updatedAt": now,
                "finishedAt": None,
            }
            try:
                result = await self.rooms.insert_one(document)
            except DuplicateKeyError:
                continue

            document["_id"] = result.inserted_id
            return self._to_public_room(document, quiz)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate a unique room code",
        )

    async def get_public_room_by_code(self, code: str) -> RoomInvitePublic:
        room = await self._get_room_by_code(code)
        if room.get("status") == "FINISHED":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Room is finished",
            )
        quiz = await self.quizzes.find_one({"_id": room["quizId"]})
        host = await self.users.find_one({"_id": room["hostId"]})
        players = room.get("players", [])
        return RoomInvitePublic(
            code=room["code"],
            status=room.get("status", "WAITING_ROOM"),
            quizTitle=quiz.get("title") if quiz else None,
            hostName=host.get("username") if host else None,
            connectedPlayersCount=sum(1 for p in players if p.get("connected", True)),
            totalPlayersCount=len(players),
            joinUrl=f"{settings.frontend_url}/join/{room['code']}",
        )

    async def get_host_room_by_code(
        self, code: str, host: UserPublic
    ) -> RoomPublic:
        room = await self._get_room_by_code(code)
        if str(room.get("hostId")) != host.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the host can access this room",
            )
        quiz = await self.quizzes.find_one({"_id": room["quizId"]})
        return self._to_public_room(room, quiz)

    async def _get_owned_quiz(self, quiz_id: str, host: UserPublic) -> dict:
        if not ObjectId.is_valid(quiz_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz not found",
            )

        quiz = await self.quizzes.find_one({"_id": ObjectId(quiz_id)})
        if quiz is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz not found",
            )

        if str(quiz["creatorId"]) != host.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the quiz creator can launch this quiz",
            )

        return quiz

    async def _get_room_by_code(self, code: str) -> dict:
        room = await self.rooms.find_one({"code": code.upper()})
        if room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found",
            )
        return room

    def _generate_room_code(self) -> str:
        alphabet = string.ascii_uppercase + string.digits
        return "".join(random.choice(alphabet) for _ in range(6))

    def _to_public_room(self, room: dict, quiz: dict | None = None) -> RoomPublic:
        players = [
            RoomPlayer(
                playerId=player["playerId"],
                userId=player.get("userId"),
                nickname=player["nickname"],
                avatarUrl=player.get("avatarUrl"),
                score=player.get("score", 0),
                connected=player.get("connected", True),
                joinedAt=player["joinedAt"],
            )
            for player in room.get("players", [])
        ]
        code = room["code"]
        return RoomPublic(
            id=str(room["_id"]),
            quizId=str(room["quizId"]),
            hostId=str(room["hostId"]),
            code=code,
            status=room.get("status", "WAITING_ROOM"),
            currentSlideIndex=room.get("currentSlideIndex", 0),
            revealSlideIndex=room.get("revealSlideIndex", 0),
            players=players,
            quizTitle=quiz.get("title") if quiz else None,
            totalSlides=len(quiz.get("slides", [])) if quiz else 0,
            joinUrl=f"{settings.frontend_url}/join/{code}",
            createdAt=room["createdAt"],
            updatedAt=room["updatedAt"],
            finishedAt=room.get("finishedAt"),
        )
