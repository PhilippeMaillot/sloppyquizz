from motor.motor_asyncio import AsyncIOMotorDatabase


async def ensure_indexes(database: AsyncIOMotorDatabase) -> None:
    # Backfill usernameKey for existing users created before username-only auth.
    await database.users.update_many(
        {"$or": [{"usernameKey": {"$exists": False}}, {"usernameKey": None}]},
        [{"$set": {"usernameKey": {"$toLower": "$username"}}}],
    )

    # Unique usernameKey (case-insensitive) for non-null values.
    await database.users.create_index(
        "usernameKey",
        unique=True,
        partialFilterExpression={"usernameKey": {"$type": "string"}},
    )
    await database.quizzes.create_index("creatorId")
    await database.rooms.create_index("code", unique=True)
    await database.rooms.create_index("quizId")
    await database.participations.create_index("quizId")
    await database.participations.create_index("userId")
    await database.participations.create_index("roomId")
    await database.participations.create_index(
        [("roomId", 1), ("playerId", 1)],
        unique=True,
    )

    await database.leaderboard_entries.create_index([("scope", 1), ("updatedAt", -1)])
    await database.leaderboard_entries.create_index([("scope", 1), ("quizId", 1)])
    await database.leaderboard_entries.create_index(
        [("scope", 1), ("quizId", 1), ("identityKey", 1)],
        unique=True,
    )

