from datetime import datetime

from pydantic import BaseModel


class AnswerValidation(BaseModel):
    method: str = "none"
    confidence: float | None = None
    reason: str | None = None
    validated_by: str | None = None


class SubmittedAnswer(BaseModel):
    answerId: str
    roomId: str
    quizId: str
    slideId: str
    playerId: str
    userId: str | None = None
    answer: str | list[str]
    submittedAt: datetime
    isCorrect: bool | None = None
    pointsAwarded: float = 0
    validation: AnswerValidation = AnswerValidation()
