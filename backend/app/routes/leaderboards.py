from fastapi import APIRouter, Query

from app.database.mongo import get_database
from app.models.leaderboard import GlobalLeaderboardEntryPublic, QuizLeaderboardEntryPublic
from app.services.leaderboard_service import LeaderboardService


router = APIRouter()


@router.get("/status")
async def leaderboards_status() -> dict[str, str]:
    return {"module": "leaderboards", "status": "ready"}


@router.get("/global", response_model=list[GlobalLeaderboardEntryPublic])
async def get_global_leaderboard(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[GlobalLeaderboardEntryPublic]:
    service = LeaderboardService(get_database())
    entries = await service.get_global_leaderboard(limit=limit, offset=offset)
    results: list[GlobalLeaderboardEntryPublic] = []
    for index, entry in enumerate(entries):
        results.append(
            GlobalLeaderboardEntryPublic(
                rank=offset + index + 1,
                userId=str(entry.get("userId")) if entry.get("userId") is not None else None,
                nickname=str(entry.get("nickname") or "Player"),
                totalPoints=float(entry.get("totalPoints") or 0),
                quizzesPlayed=int(entry.get("quizzesPlayed") or 0),
                wins=int(entry.get("wins") or 0),
                updatedAt=entry.get("updatedAt"),
            )
        )
    return results


@router.get("/quiz/{quiz_id}", response_model=list[QuizLeaderboardEntryPublic])
async def get_quiz_leaderboard(
    quiz_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[QuizLeaderboardEntryPublic]:
    service = LeaderboardService(get_database())
    entries = await service.get_quiz_leaderboard(quiz_id, limit=limit, offset=offset)
    results: list[QuizLeaderboardEntryPublic] = []
    for index, entry in enumerate(entries):
        results.append(
            QuizLeaderboardEntryPublic(
                rank=offset + index + 1,
                quizId=str(entry.get("quizId")),
                userId=str(entry.get("userId")) if entry.get("userId") is not None else None,
                nickname=str(entry.get("nickname") or "Player"),
                bestScore=float(entry.get("bestScore") or 0),
                lastScore=float(entry.get("lastScore") or 0),
                timesPlayed=int(entry.get("timesPlayed") or 0),
                updatedAt=entry.get("updatedAt"),
            )
        )
    return results

