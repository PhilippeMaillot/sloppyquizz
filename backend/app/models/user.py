from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserStats(BaseModel):
    totalPoints: int = 0
    quizzesCreated: int = 0
    quizzesPlayed: int = 0
    wins: int = 0


class UserBase(BaseModel):
    username: str = Field(min_length=2, max_length=50)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=72)


class UserLogin(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=1, max_length=72)


class UserPublic(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    avatarUrl: str | None = None
    createdAt: datetime
    updatedAt: datetime
    stats: UserStats = Field(default_factory=UserStats)


class AuthResponse(BaseModel):
    accessToken: str
    user: UserPublic
