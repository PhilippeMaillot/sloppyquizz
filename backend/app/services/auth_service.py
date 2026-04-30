from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.models.user import AuthResponse, UserCreate, UserLogin, UserPublic, UserStats
from app.utils.security import create_access_token, hash_password, verify_password


class AuthService:
    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self.database = database
        self.users = database.users

    async def register(self, payload: UserCreate) -> AuthResponse:
        now = datetime.now(timezone.utc)
        username = payload.username.strip()
        username_key = username.lower()
        user_document = {
            "username": username,
            "usernameKey": username_key,
            "passwordHash": hash_password(payload.password),
            "avatarUrl": None,
            "createdAt": now,
            "updatedAt": now,
            "stats": {
                "totalPoints": 0,
                "quizzesCreated": 0,
                "quizzesPlayed": 0,
                "wins": 0,
            },
        }

        try:
            result = await self.users.insert_one(user_document)
        except DuplicateKeyError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
            ) from error

        user_document["_id"] = result.inserted_id
        return self._build_auth_response(user_document)

    async def login(self, payload: UserLogin) -> AuthResponse:
        username_key = payload.username.strip().lower()
        user_document = await self.users.find_one({"usernameKey": username_key})
        if user_document is None or not verify_password(
            payload.password,
            user_document["passwordHash"],
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )

        return self._build_auth_response(user_document)

    async def get_user_by_id(self, user_id: str) -> UserPublic | None:
        if not ObjectId.is_valid(user_id):
            return None

        user_document = await self.users.find_one({"_id": ObjectId(user_id)})
        if user_document is None:
            return None

        return self._to_public_user(user_document)

    def _build_auth_response(self, user_document: dict) -> AuthResponse:
        user = self._to_public_user(user_document)
        token = create_access_token(subject=user.id)
        return AuthResponse(accessToken=token, user=user)

    def _to_public_user(self, user_document: dict) -> UserPublic:
        stats = user_document.get("stats") or {}
        return UserPublic(
            id=str(user_document["_id"]),
            username=user_document["username"],
            avatarUrl=user_document.get("avatarUrl"),
            createdAt=user_document["createdAt"],
            updatedAt=user_document["updatedAt"],
            stats=UserStats(
                totalPoints=stats.get("totalPoints", 0),
                quizzesCreated=stats.get("quizzesCreated", 0),
                quizzesPlayed=stats.get("quizzesPlayed", 0),
                wins=stats.get("wins", 0),
            ),
        )
