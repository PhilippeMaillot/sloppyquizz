from dataclasses import dataclass
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent


@dataclass(slots=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "SloppyQuizz API")
    api_prefix: str = os.getenv("API_PREFIX", "/api")
    app_env: str = os.getenv("APP_ENV", "development")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    backend_host: str = os.getenv("BACKEND_HOST", "0.0.0.0")
    backend_port: int = int(os.getenv("BACKEND_PORT", "8000"))
    mongo_uri: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    mongo_db_name: str = os.getenv("MONGO_DB_NAME", "sloppyquizz")
    jwt_secret: str = os.getenv("JWT_SECRET", "change_me")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )
    upload_dir: Path = BASE_DIR / os.getenv("UPLOAD_DIR", "app/uploads")


settings = Settings()
