from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class QuizSettings(BaseModel):
    revealMode: Literal["end_only"] = "end_only"
    allowLateJoin: bool = False
    manualValidation: bool = True
    shuffleQuestions: bool = False
    shuffleAnswers: bool = False


class QuizBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = ""
    coverImageUrl: str | None = None
    visibility: Literal["private", "public"] = "private"


class QuizCreate(QuizBase):
    slides: list[dict] = Field(default_factory=list)
    settings: QuizSettings = Field(default_factory=QuizSettings)


class QuizUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    coverImageUrl: str | None = None
    visibility: Literal["private", "public"] | None = None
    slides: list[dict] | None = None
    settings: QuizSettings | None = None


class QuizPublic(QuizBase):
    id: str
    creatorId: str
    slides: list[dict] = Field(default_factory=list)
    settings: QuizSettings = Field(default_factory=QuizSettings)
    createdAt: datetime
    updatedAt: datetime
