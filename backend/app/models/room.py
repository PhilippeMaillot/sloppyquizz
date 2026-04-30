from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


RoomStatus = Literal[
    "WAITING_ROOM",
    "QUESTION_ACTIVE",
    "QUESTION_LOCKED",
    "REVEAL_PHASE",
    "FINISHED",
]


class RoomPlayer(BaseModel):
    playerId: str
    userId: str | None = None
    nickname: str = Field(min_length=1, max_length=40)
    avatarUrl: str | None = None
    score: int = 0
    connected: bool = True
    joinedAt: datetime


class RoomCreate(BaseModel):
    quizId: str


class RoomInvitePublic(BaseModel):
    code: str
    status: RoomStatus = "WAITING_ROOM"
    quizTitle: str | None = None
    hostName: str | None = None
    connectedPlayersCount: int = 0
    totalPlayersCount: int = 0
    joinUrl: str | None = None


class RoomPublic(BaseModel):
    id: str
    quizId: str
    hostId: str
    code: str
    status: RoomStatus = "WAITING_ROOM"
    currentSlideIndex: int = 0
    revealSlideIndex: int = 0
    players: list[RoomPlayer] = Field(default_factory=list)
    quizTitle: str | None = None
    totalSlides: int = 0
    joinUrl: str | None = None
    createdAt: datetime
    updatedAt: datetime
    finishedAt: datetime | None = None
