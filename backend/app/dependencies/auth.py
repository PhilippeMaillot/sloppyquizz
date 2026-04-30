from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.database.mongo import get_database
from app.models.user import UserPublic
from app.services.auth_service import AuthService
from app.utils.security import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_optional_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserPublic:
    try:
        payload = decode_access_token(token)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_service = AuthService(get_database())
    user = await auth_service.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_optional_user(token: str | None = Depends(oauth2_optional_scheme)) -> UserPublic | None:
    if not token:
        return None
    try:
        payload = decode_access_token(token)
    except ValueError:
        return None

    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        return None

    auth_service = AuthService(get_database())
    return await auth_service.get_user_by_id(user_id)
