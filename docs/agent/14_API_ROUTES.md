# API Routes

## Base URL

```txt
/api
```

## Authentication Routes

### Register

```http
POST /api/auth/register
```

Body:

```json
{
  "username": "Philippe",
  "email": "user@example.com",
  "password": "password"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "user": {}
}
```

### Login

```http
POST /api/auth/login
```

Body:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "user": {}
}
```

### Me

```http
GET /api/auth/me
```

Requires authentication.

## Quiz Routes

### Get My Quizzes

```http
GET /api/quizzes
```

Requires authentication.

### Create Quiz

```http
POST /api/quizzes
```

Requires authentication.

Body:

```json
{
  "title": "My Quiz",
  "description": "Description"
}
```

### Get Quiz

```http
GET /api/quizzes/{quizId}
```

Requires authentication if quiz is private.

### Update Quiz

```http
PUT /api/quizzes/{quizId}
```

Requires authentication and ownership.

### Delete Quiz

```http
DELETE /api/quizzes/{quizId}
```

Requires authentication and ownership.

### Duplicate Quiz

```http
POST /api/quizzes/{quizId}/duplicate
```

Requires authentication.

## Room Routes

### Create Room

```http
POST /api/rooms
```

Requires authentication.

Body:

```json
{
  "quizId": "quiz_id"
}
```

Response:

```json
{
  "roomId": "room_id",
  "code": "ABC123",
  "joinUrl": "/join/ABC123"
}
```

### Get Room By Code

```http
GET /api/rooms/code/{code}
```

Public route.

### Get Room Results

```http
GET /api/rooms/{roomId}/results
```

Requires permissions depending on visibility.

## Upload Routes

### Upload Image

```http
POST /api/uploads/image
```

Form data:

```txt
file
```

Response:

```json
{
  "url": "/uploads/images/file.png"
}
```

### Upload Cover

```http
POST /api/uploads/cover
```

Form data:

```txt
file
```

Response:

```json
{
  "url": "/uploads/covers/file.png"
}
```

## Audio Routes

### Process YouTube Audio

```http
POST /api/audio/process-youtube
```

Requires authentication.

Body:

```json
{
  "quizId": "quiz_id",
  "slideId": "slide_id",
  "sourceUrl": "https://youtube.com/example",
  "startTime": 96,
  "endTime": 117
}
```

Response:

```json
{
  "audio": {
    "sourceUrl": "https://youtube.com/example",
    "storedFileUrl": "/uploads/audio/file.mp3",
    "startTime": 96,
    "endTime": 117,
    "duration": 21
  }
}
```

## Participation Routes

### Get My Participations

```http
GET /api/participations/me
```

Requires authentication.

### Get Quiz Participations

```http
GET /api/quizzes/{quizId}/participations
```

Requires quiz ownership or public permission.

## Leaderboard Routes

### Global Leaderboard

```http
GET /api/leaderboards/global
```

### Quiz Leaderboard

```http
GET /api/leaderboards/quiz/{quizId}
```

## WebSocket Endpoint

If using Socket.IO:

```txt
/socket.io
```

If using native WebSocket:

```txt
/ws
```

## WebSocket Events

See:

```txt
08_LIVE_ROOMS_WEBSOCKET.md
```
