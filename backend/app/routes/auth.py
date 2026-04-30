from fastapi import APIRouter, Depends

from app.database.mongo import get_database
from app.dependencies.auth import get_current_user
from app.models.user import AuthResponse, UserCreate, UserLogin, UserPublic
from app.services.auth_service import AuthService

router = APIRouter()


@router.get("/status")
async def auth_status() -> dict[str, str]:
    return {"module": "auth", "status": "ready"}


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(payload: UserCreate) -> AuthResponse:
    auth_service = AuthService(get_database())
    return await auth_service.register(payload)


@router.post("/login", response_model=AuthResponse)
async def login(payload: UserLogin) -> AuthResponse:
    auth_service = AuthService(get_database())
    return await auth_service.login(payload)


@router.get("/me", response_model=UserPublic)
async def me(current_user: UserPublic = Depends(get_current_user)) -> UserPublic:
    return current_user
