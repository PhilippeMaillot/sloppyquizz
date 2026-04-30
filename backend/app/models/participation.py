from datetime import datetime

from pydantic import BaseModel, Field


class ParticipationPublic(BaseModel):
    id: str
    quizId: str
    quizTitle: str | None = None
    quizCoverImageUrl: str | None = None
    roomId: str
    playerId: str
    userId: str | None = None
    nickname: str = Field(min_length=1, max_length=40)
    score: int
    rank: int
    correctAnswersCount: int = 0
    answers: list[dict] = Field(default_factory=list)
    playedAt: datetime


class RoomResultsPublic(BaseModel):
    roomId: str
    quizId: str
    quizTitle: str | None = None
    finishedAt: datetime
    results: list[ParticipationPublic] = Field(default_factory=list)

