from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio

from app.config import settings
from app.database.indexes import ensure_indexes
from app.database.mongo import mongo_db
from app.routes import api_router
from app.websocket.socket_app import sio


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    await mongo_db.connect()
    await ensure_indexes(mongo_db.get_database())
    yield
    await mongo_db.disconnect()


fastapi_app = FastAPI(title=settings.app_name, lifespan=lifespan)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
fastapi_app.include_router(api_router, prefix=settings.api_prefix)

app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=fastapi_app,
    socketio_path="socket.io",
)
