from fastapi import APIRouter

from app.routes.auth import router as auth_router
from app.routes.health import router as health_router
from app.routes.quizzes import router as quizzes_router
from app.routes.rooms import router as rooms_router
from app.routes.uploads import router as uploads_router
from app.routes.audio import router as audio_router
from app.routes.leaderboards import router as leaderboards_router
from app.routes.participations import router as participations_router


api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(quizzes_router, prefix="/quizzes", tags=["quizzes"])
api_router.include_router(rooms_router, prefix="/rooms", tags=["rooms"])
api_router.include_router(uploads_router, prefix="/uploads", tags=["uploads"])
api_router.include_router(audio_router, prefix="/audio", tags=["audio"])
api_router.include_router(
    leaderboards_router, prefix="/leaderboards", tags=["leaderboards"]
)
api_router.include_router(
    participations_router, prefix="/participations", tags=["participations"]
)
