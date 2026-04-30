# Tech Stack

## Frontend

The frontend uses:

- React
- React Router
- TypeScript recommended
- Zustand or Redux Toolkit for global state
- Tailwind CSS or MUI for UI
- WebSocket client or Socket.IO client
- QR code generation library

Recommended libraries:

```txt
react
react-router-dom
zustand
axios
socket.io-client
qrcode.react
react-hook-form
zod
```

## Backend

The backend uses:

- Python
- FastAPI
- Uvicorn
- MongoDB async driver
- WebSocket or python-socketio
- JWT authentication
- bcrypt password hashing
- yt-dlp
- ffmpeg

Recommended libraries:

```txt
fastapi
uvicorn
motor
pydantic
python-jose
passlib[bcrypt]
python-multipart
python-socketio
yt-dlp
```

## Database

The database is MongoDB.

MongoDB is used because quizzes are document-based and slides can have different structures depending on their question type.

Main collections:

- users
- quizzes
- rooms
- participations
- uploaded_files
- leaderboard_entries

## Realtime Layer

The live quiz system uses WebSocket communication.

Recommended option:

- FastAPI + python-socketio

Reason:

- room management is easier;
- events are named clearly;
- reconnection can be handled better;
- the frontend can use socket.io-client.

Native WebSocket can also be used, but requires more manual room logic.

## Audio Processing

Blind test slides require audio extraction.

Tools:

- yt-dlp to download audio from a provided URL;
- ffmpeg to cut the selected excerpt;
- local storage for generated audio files.

Example flow:

```txt
YouTube URL
→ yt-dlp downloads audio
→ ffmpeg cuts selected timestamp range
→ backend stores generated file
→ quiz slide stores audio file path
```

## Answer Correction

Answers are corrected manually by the host during the reveal phase.

Do not call an AI service to validate player answers.

## Environment Variables

Required environment variables:

```env
MONGO_URI=mongodb://localhost:27017/quiz_app
JWT_SECRET=change_me
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
UPLOAD_DIR=uploads
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
```

## Development Ports

Suggested local ports:

```txt
Frontend: 5173
Backend: 8000
MongoDB: 27017
```

## Docker Readiness

The project should be structured so it can later be containerized with Docker Compose.

Expected services:

- frontend
- backend
- mongodb
- optional nginx
