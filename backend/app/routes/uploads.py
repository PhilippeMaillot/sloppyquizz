from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.config import settings
from app.dependencies.auth import get_current_user
from app.models.user import UserPublic


router = APIRouter()

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_VIDEO_BYTES = 100 * 1024 * 1024
ALLOWED_IMAGE_MIME = {"image/png", "image/jpeg", "image/webp"}
ALLOWED_VIDEO_MIME = {"video/mp4"}


@router.get("/status")
async def uploads_status() -> dict[str, str]:
    return {"module": "uploads", "status": "ready"}


def _extension_for_mime(mime: str) -> str:
    if mime == "image/png":
        return "png"
    if mime == "image/jpeg":
        return "jpg"
    if mime == "image/webp":
        return "webp"
    if mime == "video/mp4":
        return "mp4"
    raise ValueError("Unsupported mime type")


def _looks_like_upload(first_bytes: bytes, mime: str) -> bool:
    if mime == "image/png":
        return first_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    if mime == "image/jpeg":
        return first_bytes.startswith(b"\xff\xd8\xff")
    if mime == "image/webp":
        # RIFF....WEBP
        return len(first_bytes) >= 12 and first_bytes[0:4] == b"RIFF" and first_bytes[8:12] == b"WEBP"
    if mime == "video/mp4":
        # ISO BMFF/MP4 files declare an ftyp box near the start.
        return len(first_bytes) >= 12 and first_bytes[4:8] == b"ftyp"
    return False


async def _store_upload(
    file: UploadFile,
    folder: Path,
    *,
    allowed_mime: set[str],
    max_bytes: int,
    label: str,
) -> str:
    if not file.content_type or file.content_type not in allowed_mime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported {label} type",
        )

    folder.mkdir(parents=True, exist_ok=True)

    ext = _extension_for_mime(file.content_type)
    name = f"{uuid4().hex}.{ext}"
    tmp_path = folder / f".{name}.tmp"
    final_path = folder / name

    size = 0

    try:
        first = await file.read(32)
        if not _looks_like_upload(first, file.content_type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid {label} file",
            )

        with tmp_path.open("wb") as out:
            if first:
                out.write(first)
                size += len(first)
            if size > max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"{label.title()} too large",
                )

            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"{label.title()} too large",
                    )

        tmp_path.replace(final_path)
    finally:
        try:
            await file.close()
        except Exception:
            pass
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass

    relative = final_path.relative_to(settings.upload_dir)
    return f"/uploads/{relative.as_posix()}"


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    _: UserPublic = Depends(get_current_user),
) -> dict[str, str]:
    url = await _store_upload(
        file,
        settings.upload_dir / "images",
        allowed_mime=ALLOWED_IMAGE_MIME,
        max_bytes=MAX_IMAGE_BYTES,
        label="image",
    )
    return {"url": url}


@router.post("/cover")
async def upload_cover(
    file: UploadFile = File(...),
    _: UserPublic = Depends(get_current_user),
) -> dict[str, str]:
    url = await _store_upload(
        file,
        settings.upload_dir / "covers",
        allowed_mime=ALLOWED_IMAGE_MIME,
        max_bytes=MAX_IMAGE_BYTES,
        label="image",
    )
    return {"url": url}


@router.post("/video")
async def upload_video(
    file: UploadFile = File(...),
    _: UserPublic = Depends(get_current_user),
) -> dict[str, str]:
    url = await _store_upload(
        file,
        settings.upload_dir / "videos",
        allowed_mime=ALLOWED_VIDEO_MIME,
        max_bytes=MAX_VIDEO_BYTES,
        label="video",
    )
    return {"url": url}

