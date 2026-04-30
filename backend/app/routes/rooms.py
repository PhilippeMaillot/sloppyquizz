from fastapi import APIRouter, Depends, status

from app.database.mongo import get_database
from app.dependencies.auth import get_current_user
from app.models.participation import RoomResultsPublic
from app.models.room import RoomCreate, RoomInvitePublic, RoomPublic
from app.models.user import UserPublic
from app.services.participation_service import ParticipationService
from app.services.room_service import RoomService

router = APIRouter()


@router.get("/status")
async def rooms_status() -> dict[str, str]:
    return {"module": "rooms", "status": "ready"}


@router.post("", response_model=RoomPublic, status_code=status.HTTP_201_CREATED)
async def create_room(
    payload: RoomCreate,
    current_user: UserPublic = Depends(get_current_user),
) -> RoomPublic:
    room_service = RoomService(get_database())
    return await room_service.create_room(payload, current_user)


@router.get("/code/{code}", response_model=RoomInvitePublic)
async def get_room_by_code(code: str) -> RoomInvitePublic:
    room_service = RoomService(get_database())
    return await room_service.get_public_room_by_code(code)


@router.get("/host/code/{code}", response_model=RoomPublic)
async def get_host_room_by_code(
    code: str,
    current_user: UserPublic = Depends(get_current_user),
) -> RoomPublic:
    room_service = RoomService(get_database())
    return await room_service.get_host_room_by_code(code, current_user)


@router.get("/{room_id}/results", response_model=RoomResultsPublic)
async def get_room_results(room_id: str) -> RoomResultsPublic:
    service = ParticipationService(get_database())
    return await service.get_room_results(room_id)
