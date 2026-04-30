from fastapi import APIRouter, Depends, status

from app.database.mongo import get_database
from app.dependencies.auth import get_current_user, get_optional_user
from app.models.participation import ParticipationPublic
from app.models.quiz import QuizCreate, QuizPublic, QuizUpdate
from app.models.user import UserPublic
from app.services.participation_service import ParticipationService
from app.services.quiz_service import QuizService

router = APIRouter()


@router.get("/status")
async def quizzes_status() -> dict[str, str]:
    return {"module": "quizzes", "status": "ready"}


@router.post("", response_model=QuizPublic, status_code=status.HTTP_201_CREATED)
async def create_quiz(
    payload: QuizCreate,
    current_user: UserPublic = Depends(get_current_user),
) -> QuizPublic:
    quiz_service = QuizService(get_database())
    return await quiz_service.create_quiz(payload, current_user)


@router.get("", response_model=list[QuizPublic])
async def list_my_quizzes(
    current_user: UserPublic = Depends(get_current_user),
) -> list[QuizPublic]:
    quiz_service = QuizService(get_database())
    return await quiz_service.list_my_quizzes(current_user)


@router.get("/{quiz_id}", response_model=QuizPublic)
async def get_quiz(
    quiz_id: str,
    current_user: UserPublic = Depends(get_current_user),
) -> QuizPublic:
    quiz_service = QuizService(get_database())
    return await quiz_service.get_quiz(quiz_id, current_user)


@router.put("/{quiz_id}", response_model=QuizPublic)
async def update_quiz(
    quiz_id: str,
    payload: QuizUpdate,
    current_user: UserPublic = Depends(get_current_user),
) -> QuizPublic:
    quiz_service = QuizService(get_database())
    return await quiz_service.update_quiz(quiz_id, payload, current_user)


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(
    quiz_id: str,
    current_user: UserPublic = Depends(get_current_user),
) -> None:
    quiz_service = QuizService(get_database())
    await quiz_service.delete_quiz(quiz_id, current_user)


@router.get("/{quiz_id}/participations", response_model=list[ParticipationPublic])
async def get_quiz_participations(
    quiz_id: str,
    current_user: UserPublic | None = Depends(get_optional_user),
) -> list[ParticipationPublic]:
    service = ParticipationService(get_database())
    return await service.get_quiz_participations(quiz_id, current_user)
