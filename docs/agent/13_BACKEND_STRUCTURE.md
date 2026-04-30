# Backend Structure

## Framework

The backend uses FastAPI.

## Suggested Folder Structure

```txt
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database/
│   │   ├── mongo.py
│   │   └── indexes.py
│   ├── routes/
│   │   ├── auth.py
│   │   ├── quizzes.py
│   │   ├── rooms.py
│   │   ├── uploads.py
│   │   ├── audio.py
│   │   ├── leaderboards.py
│   │   └── participations.py
│   ├── models/
│   │   ├── user.py
│   │   ├── quiz.py
│   │   ├── room.py
│   │   ├── answer.py
│   │   └── participation.py
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── quiz_service.py
│   │   ├── room_service.py
│   │   ├── scoring_service.py
│   │   ├── reveal_service.py
│   │   ├── groq_service.py
│   │   ├── audio_service.py
│   │   └── leaderboard_service.py
│   ├── websocket/
│   │   ├── socket_app.py
│   │   ├── room_manager.py
│   │   └── events.py
│   ├── utils/
│   │   ├── security.py
│   │   ├── ids.py
│   │   ├── dates.py
│   │   └── text_normalization.py
│   └── uploads/
├── requirements.txt
└── .env
```

## main.py

Responsibilities:

- create FastAPI app;
- configure CORS;
- include routers;
- mount static uploads;
- initialize socket app if using Socket.IO.

## config.py

Loads environment variables.

Example values:

- MongoDB URI;
- JWT secret;
- upload directory;
- frontend URL.

## routes/

Routes should only handle HTTP request/response logic.

Business logic should be placed in services.

## services/

Services contain core logic.

Examples:

- create quiz;
- update quiz;
- validate answer;
- calculate score;
- process audio;
- update leaderboard.

## models/

Models contain Pydantic schemas.

Use separate schemas for:

- creation;
- update;
- database output;
- public response.

## websocket/

Contains realtime logic.

### room_manager.py

Responsible for:

- active rooms;
- connected players;
- broadcasting;
- joining/leaving;
- updating current slide.

### events.py

Defines event names and payload handling.

## database/

Contains MongoDB client and indexes.

Recommended indexes:

```txt
users.email unique
quizzes.creatorId
rooms.code unique
rooms.quizId
participations.quizId
participations.userId
```

## uploads/

Stores uploaded and generated files for MVP.

Suggested subfolders:

```txt
uploads/
├── images/
├── audio/
├── avatars/
└── covers/
```

## Error Handling

Backend should return clear errors:

```json
{
  "detail": "Quiz not found"
}
```

## Security

Backend must:

- hash passwords;
- validate JWT;
- protect private routes;
- validate file uploads;
- never expose secret keys.
