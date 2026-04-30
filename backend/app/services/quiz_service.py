from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.quiz import QuizCreate, QuizPublic, QuizSettings, QuizUpdate
from app.models.user import UserPublic


class QuizService:
    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self.database = database
        self.quizzes = database.quizzes
        self.users = database.users

    async def create_quiz(self, payload: QuizCreate, creator: UserPublic) -> QuizPublic:
        now = datetime.now(timezone.utc)
        document = {
            "creatorId": ObjectId(creator.id),
            "title": payload.title.strip(),
            "description": payload.description,
            "coverImageUrl": payload.coverImageUrl,
            "visibility": payload.visibility,
            "slides": payload.slides,
            "settings": payload.settings.model_dump(),
            "createdAt": now,
            "updatedAt": now,
        }

        result = await self.quizzes.insert_one(document)
        await self.users.update_one(
            {"_id": ObjectId(creator.id)},
            {"$inc": {"stats.quizzesCreated": 1}},
        )
        document["_id"] = result.inserted_id
        return self._to_public_quiz(document)

    async def list_my_quizzes(self, creator: UserPublic) -> list[QuizPublic]:
        cursor = self.quizzes.find({"creatorId": ObjectId(creator.id)}).sort(
            "updatedAt", -1
        )
        return [self._to_public_quiz(document) async for document in cursor]

    async def get_quiz(self, quiz_id: str, user: UserPublic) -> QuizPublic:
        document = await self._get_quiz_document(quiz_id)
        self._ensure_can_read(document, user)
        return self._to_public_quiz(document)

    async def update_quiz(
        self,
        quiz_id: str,
        payload: QuizUpdate,
        user: UserPublic,
    ) -> QuizPublic:
        document = await self._get_quiz_document(quiz_id)
        self._ensure_owner(document, user)

        update_payload = payload.model_dump(exclude_unset=True)
        if "title" in update_payload and update_payload["title"] is not None:
            update_payload["title"] = update_payload["title"].strip()

        if "settings" in update_payload and update_payload["settings"] is not None:
            update_payload["settings"] = payload.settings.model_dump()

        update_payload["updatedAt"] = datetime.now(timezone.utc)

        await self.quizzes.update_one(
            {"_id": document["_id"]},
            {"$set": update_payload},
        )
        updated_document = await self._get_quiz_document(quiz_id)
        return self._to_public_quiz(updated_document)

    async def delete_quiz(self, quiz_id: str, user: UserPublic) -> None:
        document = await self._get_quiz_document(quiz_id)
        self._ensure_owner(document, user)
        await self.quizzes.delete_one({"_id": document["_id"]})

    async def _get_quiz_document(self, quiz_id: str) -> dict:
        if not ObjectId.is_valid(quiz_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz not found",
            )

        document = await self.quizzes.find_one({"_id": ObjectId(quiz_id)})
        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz not found",
            )
        return document

    def _ensure_owner(self, document: dict, user: UserPublic) -> None:
        if str(document["creatorId"]) != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify this quiz",
            )

    def _ensure_can_read(self, document: dict, user: UserPublic) -> None:
        if document.get("visibility") == "public":
            return
        self._ensure_owner(document, user)

    def _to_public_quiz(self, document: dict) -> QuizPublic:
        settings = document.get("settings") or {}
        return QuizPublic(
            id=str(document["_id"]),
            creatorId=str(document["creatorId"]),
            title=document["title"],
            description=document.get("description", ""),
            coverImageUrl=document.get("coverImageUrl"),
            visibility=document.get("visibility", "private"),
            slides=document.get("slides", []),
            settings=QuizSettings(
                revealMode=settings.get("revealMode", "end_only"),
                allowLateJoin=settings.get("allowLateJoin", False),
                manualValidation=settings.get("manualValidation", True),
                shuffleQuestions=settings.get("shuffleQuestions", False),
                shuffleAnswers=settings.get("shuffleAnswers", False),
            ),
            createdAt=document["createdAt"],
            updatedAt=document["updatedAt"],
        )
