from datetime import datetime

from pydantic import BaseModel


class QuizLeaderboardEntryPublic(BaseModel):
    rank: int
    quizId: str
    userId: str | None = None
    nickname: str
    bestScore: int
    lastScore: int
    timesPlayed: int
    updatedAt: datetime


class GlobalLeaderboardEntryPublic(BaseModel):
    rank: int
    userId: str | None = None
    nickname: str
    totalPoints: int
    quizzesPlayed: int
    wins: int
    updatedAt: datetime

