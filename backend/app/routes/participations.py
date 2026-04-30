from fastapi import APIRouter, Depends

from app.database.mongo import get_database
from app.dependencies.auth import get_current_user
from app.models.participation import ParticipationPublic
from app.models.user import UserPublic
from app.services.participation_service import ParticipationService


router = APIRouter()


@router.get("/status")
async def participations_status() -> dict[str, str]:
    return {"module": "participations", "status": "ready"}


@router.get("/me", response_model=list[ParticipationPublic])
async def list_my_participations(
    current_user: UserPublic = Depends(get_current_user),
) -> list[ParticipationPublic]:
    service = ParticipationService(get_database())
    return await service.get_my_participations(current_user)

