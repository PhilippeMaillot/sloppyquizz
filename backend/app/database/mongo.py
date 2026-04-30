from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings


class MongoDatabase:
    def __init__(self) -> None:
        self.client: Optional[AsyncIOMotorClient] = None
        self.database: Optional[AsyncIOMotorDatabase] = None

    async def connect(self) -> None:
        if self.client is not None:
            return

        self.client = AsyncIOMotorClient(settings.mongo_uri)
        self.database = self.client[settings.mongo_db_name]
        await self.client.admin.command("ping")

    async def disconnect(self) -> None:
        if self.client is None:
            return

        self.client.close()
        self.client = None
        self.database = None

    def get_database(self) -> AsyncIOMotorDatabase:
        if self.database is None:
            raise RuntimeError("MongoDB is not initialized.")
        return self.database

    async def ping(self) -> bool:
        if self.client is None:
            return False

        try:
            await self.client.admin.command("ping")
        except Exception:
            return False
        return True


mongo_db = MongoDatabase()


def get_database() -> AsyncIOMotorDatabase:
    return mongo_db.get_database()

