from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.config import settings
from app.dependencies.auth import get_current_user
from app.models.user import UserPublic


router = APIRouter()

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_MIME = {"image/png", "image/jpeg", "image/webp"}


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
    raise ValueError("Unsupported mime type")


def _looks_like_image(first_bytes: bytes, mime: str) -> bool:
    if mime == "image/png":
        return first_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    if mime == "image/jpeg":
        return first_bytes.startswith(b"\xff\xd8\xff")
    if mime == "image/webp":
        # RIFF....WEBP
        return len(first_bytes) >= 12 and first_bytes[0:4] == b"RIFF" and first_bytes[8:12] == b"WEBP"
    return False


async def _store_upload(file: UploadFile, folder: Path) -> str:
    if not file.content_type or file.content_type not in ALLOWED_IMAGE_MIME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type",
        )

    folder.mkdir(parents=True, exist_ok=True)

    ext = _extension_for_mime(file.content_type)
    name = f"{uuid4().hex}.{ext}"
    tmp_path = folder / f".{name}.tmp"
    final_path = folder / name

    size = 0

    try:
        first = await file.read(32)
        if not _looks_like_image(first, file.content_type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid image file",
            )

        with tmp_path.open("wb") as out:
            if first:
                out.write(first)
                size += len(first)
            if size > MAX_IMAGE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Image too large",
                )

            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
                size += len(chunk)
                if size > MAX_IMAGE_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Image too large",
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
    url = await _store_upload(file, settings.upload_dir / "images")
    return {"url": url}


@router.post("/cover")
async def upload_cover(
    file: UploadFile = File(...),
    _: UserPublic = Depends(get_current_user),
) -> dict[str, str]:
    url = await _store_upload(file, settings.upload_dir / "covers")
    return {"url": url}

