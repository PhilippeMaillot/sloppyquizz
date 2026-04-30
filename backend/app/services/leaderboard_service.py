from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase


class LeaderboardService:
    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self.database = database
        self.rooms = database.rooms
        self.participations = database.participations
        # NOTE: We intentionally do NOT maintain a separate leaderboard_entries collection anymore.
        # Leaderboards are computed from participations (source of truth) via Mongo aggregations.

    async def get_quiz_leaderboard(self, quiz_id: str, *, limit: int, offset: int) -> list[dict]:
        if not ObjectId.is_valid(quiz_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

        qid = ObjectId(quiz_id)
        pipeline: list[dict] = [
            {"$match": {"quizId": qid}},
            {
                "$addFields": {
                    "_identityKey": {
                        "$cond": [
                            {"$ne": ["$userId", None]},
                            {"$concat": ["user:", {"$toString": "$userId"}]},
                            {
                                "$concat": [
                                    "guest:",
                                    {"$toLower": {"$trim": {"input": {"$ifNull": ["$nickname", "Player"]}}}},
                                ]
                            },
                        ]
                    }
                }
            },
            # Keep per-play record.
            {
                "$project": {
                    "identityKey": "$_identityKey",
                    "userId": 1,
                    "nickname": {"$ifNull": ["$nickname", "Player"]},
                    "score": {"$ifNull": ["$score", 0]},
                    "playedAt": {"$ifNull": ["$playedAt", datetime.now(timezone.utc)]},
                }
            },
            {
                "$sort": {"playedAt": -1},
            },
            {
                "$group": {
                    "_id": "$identityKey",
                    "quizId": {"$first": qid},
                    "identityKey": {"$first": "$identityKey"},
                    "userId": {"$first": "$userId"},
                    "nickname": {"$first": "$nickname"},
                    "lastScore": {"$first": "$score"},
                    "updatedAt": {"$first": "$playedAt"},
                    "bestScore": {"$max": "$score"},
                    "timesPlayed": {"$sum": 1},
                }
            },
            {"$sort": {"bestScore": -1, "updatedAt": -1}},
            {"$skip": int(offset)},
            {"$limit": int(limit)},
        ]
        return await self.participations.aggregate(pipeline).to_list(length=limit)

    async def get_global_leaderboard(self, *, limit: int, offset: int) -> list[dict]:
        pipeline: list[dict] = [
            {
                "$addFields": {
                    "_identityKey": {
                        "$cond": [
                            {"$ne": ["$userId", None]},
                            {"$concat": ["user:", {"$toString": "$userId"}]},
                            {
                                "$concat": [
                                    "guest:",
                                    {"$toLower": {"$trim": {"input": {"$ifNull": ["$nickname", "Player"]}}}},
                                ]
                            },
                        ]
                    }
                }
            },
            {
                "$project": {
                    "identityKey": "$_identityKey",
                    "userId": 1,
                    "nickname": {"$ifNull": ["$nickname", "Player"]},
                    "score": {"$ifNull": ["$score", 0]},
                    "rank": {"$ifNull": ["$rank", 0]},
                    "playedAt": {"$ifNull": ["$playedAt", datetime.now(timezone.utc)]},
                }
            },
            {
                "$group": {
                    "_id": "$identityKey",
                    "identityKey": {"$first": "$identityKey"},
                    "userId": {"$first": "$userId"},
                    "nickname": {"$first": "$nickname"},
                    "totalPoints": {"$sum": "$score"},
                    "quizzesPlayed": {"$sum": 1},
                    "wins": {"$sum": {"$cond": [{"$eq": ["$rank", 1]}, 1, 0]}},
                    "updatedAt": {"$max": "$playedAt"},
                }
            },
            {"$sort": {"totalPoints": -1, "updatedAt": -1}},
            {"$skip": int(offset)},
            {"$limit": int(limit)},
        ]
        return await self.participations.aggregate(pipeline).to_list(length=limit)

