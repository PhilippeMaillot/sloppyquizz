from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import HTTPException, status

from app.config import settings


@dataclass(frozen=True)
class ProcessedAudio:
    sourceUrl: str
    storedFileUrl: str
    startTime: int
    endTime: int
    duration: int


@dataclass(frozen=True)
class YoutubeAudioPreview:
    sourceUrl: str
    previewUrl: str
    title: str | None
    duration: int | None


class AudioService:
    MAX_DURATION_SECONDS = 60

    def ensure_ytdlp(self) -> None:
        if shutil.which("yt-dlp") is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="yt-dlp is not installed. Install it to enable blind test audio processing.",
            )

    def ensure_dependencies(self) -> None:
        self.ensure_ytdlp()
        if shutil.which("ffmpeg") is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ffmpeg is not installed. Install it to enable blind test audio processing.",
            )

    def validate_source_url(self, source_url: str) -> None:
        if not isinstance(source_url, str) or not source_url.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sourceUrl is required")

    def validate_request(self, *, source_url: str, start_time: int, end_time: int) -> None:
        self.validate_source_url(source_url)
        if not isinstance(start_time, int) or start_time < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="startTime must be >= 0")
        if not isinstance(end_time, int) or end_time <= start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="endTime must be greater than startTime",
            )
        duration = end_time - start_time
        if duration > self.MAX_DURATION_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Extract duration is too long (max {self.MAX_DURATION_SECONDS}s)",
            )

    def prepare_youtube_preview(self, *, source_url: str) -> YoutubeAudioPreview:
        self.ensure_ytdlp()
        self.validate_source_url(source_url)

        ytdlp_cmd = [
            "yt-dlp",
            "--dump-single-json",
            "--no-playlist",
            "--no-warnings",
            "-f",
            "bestaudio/best",
            source_url,
        ]
        try:
            ytdlp = subprocess.run(
                ytdlp_cmd,
                capture_output=True,
                text=True,
                check=False,
                timeout=90,
            )
        except subprocess.TimeoutExpired as error:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="yt-dlp took too long to return audio metadata",
            ) from error
        if ytdlp.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"yt-dlp failed: {ytdlp.stderr.strip() or ytdlp.stdout.strip() or 'unknown error'}",
            )

        try:
            info = json.loads(ytdlp.stdout)
        except json.JSONDecodeError as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="yt-dlp did not return valid metadata",
            ) from error

        preview_url = info.get("url")
        requested_downloads = info.get("requested_downloads")
        if not preview_url and isinstance(requested_downloads, list) and requested_downloads:
            first_download = requested_downloads[0]
            if isinstance(first_download, dict):
                preview_url = first_download.get("url")

        if not isinstance(preview_url, str) or not preview_url:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="yt-dlp did not return a playable audio URL",
            )

        duration_raw = info.get("duration")
        duration = int(duration_raw) if isinstance(duration_raw, (int, float)) else None
        title_raw = info.get("title")

        return YoutubeAudioPreview(
            sourceUrl=source_url,
            previewUrl=preview_url,
            title=title_raw if isinstance(title_raw, str) else None,
            duration=duration,
        )

    def process_youtube_audio(
        self,
        *,
        source_url: str,
        start_time: int,
        end_time: int,
        quiz_id: str,
        slide_id: str,
    ) -> ProcessedAudio:
        self.ensure_dependencies()
        self.validate_request(source_url=source_url, start_time=start_time, end_time=end_time)

        now = datetime.now(timezone.utc)
        safe_quiz = "".join(ch for ch in quiz_id if ch.isalnum() or ch in {"_", "-"})
        safe_slide = "".join(ch for ch in slide_id if ch.isalnum() or ch in {"_", "-"})
        filename = f"{safe_quiz}_{safe_slide}_{int(now.timestamp())}.mp3"
        audio_dir = settings.upload_dir / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)
        output_path = audio_dir / filename

        try:
            with tempfile.TemporaryDirectory(prefix="sloppyquizz-audio-") as tmp_dir:
                tmp_dir_path = Path(tmp_dir)
                downloaded_path = tmp_dir_path / "downloaded.%(ext)s"

                # Download bestaudio only, no shell interpolation, args list for safety.
                ytdlp_cmd = [
                    "yt-dlp",
                    "--no-playlist",
                    "-f",
                    "bestaudio/best",
                    "-o",
                    str(downloaded_path),
                    source_url,
                ]
                ytdlp = subprocess.run(
                    ytdlp_cmd,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if ytdlp.returncode != 0:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"yt-dlp failed: {ytdlp.stderr.strip() or ytdlp.stdout.strip() or 'unknown error'}",
                    )

                # Find the downloaded file (yt-dlp replaced %(ext)s).
                candidates = list(tmp_dir_path.glob("downloaded.*"))
                if not candidates:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="yt-dlp did not produce any output file",
                    )
                input_path = candidates[0]

                # Cut with ffmpeg. Re-encode to mp3 for consistent output.
                ffmpeg_cmd = [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-ss",
                    str(start_time),
                    "-to",
                    str(end_time),
                    "-i",
                    str(input_path),
                    "-vn",
                    "-acodec",
                    "libmp3lame",
                    "-b:a",
                    "192k",
                    str(output_path),
                ]
                ffmpeg = subprocess.run(
                    ffmpeg_cmd,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if ffmpeg.returncode != 0:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"ffmpeg failed: {ffmpeg.stderr.strip() or 'unknown error'}",
                    )

        except HTTPException:
            raise
        except Exception as error:  # pragma: no cover (safety net)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Audio processing failed: {error}",
            ) from error

        stored_url = f"/uploads/audio/{filename}"
        return ProcessedAudio(
            sourceUrl=source_url,
            storedFileUrl=stored_url,
            startTime=start_time,
            endTime=end_time,
            duration=end_time - start_time,
        )

