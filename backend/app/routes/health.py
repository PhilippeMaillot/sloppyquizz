from fastapi import APIRouter

from app.database.mongo import mongo_db


router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, object]:
    mongo_connected = await mongo_db.ping()
    return {
        "status": "ok" if mongo_connected else "degraded",
        "services": {
            "api": "ok",
            "mongodb": "ok" if mongo_connected else "unreachable",
        },
    }

