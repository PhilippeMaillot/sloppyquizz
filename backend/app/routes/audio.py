from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from bson import ObjectId

from app.database.mongo import get_database
from app.dependencies.auth import get_current_user
from app.models.user import UserPublic
from app.services.audio_service import AudioService, ProcessedAudio


router = APIRouter()


@router.get("/status")
async def audio_status() -> dict[str, str]:
    return {"module": "audio", "status": "ready"}


class ProcessYoutubePayload(BaseModel):
    quizId: str = Field(min_length=1)
    slideId: str = Field(min_length=1)
    sourceUrl: str = Field(min_length=1)
    startTime: int
    endTime: int


class ProcessYoutubeResponse(BaseModel):
    audio: ProcessedAudio


@router.post("/process-youtube", response_model=ProcessYoutubeResponse)
async def process_youtube_audio(
    payload: ProcessYoutubePayload,
    current_user: UserPublic = Depends(get_current_user),
) -> ProcessYoutubeResponse:
    database = get_database()
    audio_service = AudioService()

    if not ObjectId.is_valid(payload.quizId):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    quiz = await database.quizzes.find_one({"_id": ObjectId(payload.quizId)})
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    if str(quiz.get("creatorId")) != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the quiz creator can process audio",
        )

    audio = audio_service.process_youtube_audio(
        source_url=payload.sourceUrl,
        start_time=int(payload.startTime),
        end_time=int(payload.endTime),
        quiz_id=payload.quizId,
        slide_id=payload.slideId,
    )
    return ProcessYoutubeResponse(audio=audio)

