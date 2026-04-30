# Blind Test Audio

## Goal

Blind test slides allow the quiz creator to use audio excerpts.

The creator can provide a YouTube link and select a specific time range.

The backend downloads the audio and generates an excerpt.

## User Flow

1. Creator creates a blind test slide.
2. Creator pastes a YouTube URL.
3. Creator sets start time.
4. Creator sets end time.
5. Backend processes the audio.
6. Creator previews the generated excerpt.
7. Slide stores the generated audio file URL.

## Example

```txt
YouTube URL: https://youtube.com/example
Start: 01:36
End: 01:57
```

Converted to seconds:

```txt
Start: 96
End: 117
Duration: 21
```

## Backend Flow

```txt
POST /audio/process
    ↓
Validate URL and timestamps
    ↓
Download audio with yt-dlp
    ↓
Cut audio with ffmpeg
    ↓
Store generated file
    ↓
Return stored audio URL
```

## Required Tools

- yt-dlp
- ffmpeg

## Suggested Backend Service

```txt
backend/services/audio_service.py
```

## Suggested Function

```python
async def process_youtube_audio(
    source_url: str,
    start_time: int,
    end_time: int,
    quiz_id: str,
    slide_id: str
) -> dict:
    pass
```

## Output

```json
{
  "sourceUrl": "https://youtube.com/example",
  "storedFileUrl": "/uploads/audio/quiz_123_slide_4.mp3",
  "startTime": 96,
  "endTime": 117,
  "duration": 21
}
```

## File Naming

Recommended generated file format:

```txt
uploads/audio/{quiz_id}_{slide_id}_{timestamp}.mp3
```

Example:

```txt
uploads/audio/quiz123_slide4_1714480000.mp3
```

## Timestamp Validation

Rules:

- start time must be >= 0;
- end time must be greater than start time;
- maximum duration should be limited;
- URL must be valid;
- file size should be controlled.

Recommended max extract duration:

```txt
60 seconds
```

## Frontend Fields

Blind test editor should include:

- YouTube URL input;
- start time input;
- end time input;
- process button;
- audio preview player;
- expected answer input;
- aliases input;
- answer mode selection.

## Live Presentation

During the live quiz, the host sees:

- question title;
- audio play button;
- optional image;
- number of submitted answers.

Players may or may not have access to the audio player depending on product choice.

MVP recommendation:

- the host controls playback;
- players answer from their own device.

## Legal Note

For public production use, downloading copyrighted YouTube content may be legally sensitive.

The app should later support:

- uploaded audio files;
- royalty-free music;
- creator-owned files.

For MVP or private school project, yt-dlp can be used for testing.
