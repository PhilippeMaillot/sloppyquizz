# Security and Authentication

## Authentication Strategy

The application uses JWT authentication.

Users register and log in with:

- email;
- password.

Passwords must be hashed before being stored.

Recommended hashing:

```txt
bcrypt
```

## JWT

JWT tokens are issued on login and register.

The token contains:

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "exp": "expiration"
}
```

## Protected Routes

Protected routes require a valid JWT.

Protected resources:

- creating quizzes;
- editing quizzes;
- deleting quizzes;
- launching rooms;
- processing YouTube audio;
- uploading files;
- viewing private quiz data.

## Ownership Checks

A user can only edit or delete quizzes they own.

Before updating a quiz:

1. get quiz by ID;
2. compare `quiz.creatorId` with authenticated user ID;
3. reject if they do not match.

## Public Player Access

Players can join rooms without an account.

In that case:

- assign a temporary `playerId`;
- store nickname;
- `userId` is null.

If a player is logged in:

- link participation to their `userId`.

## Password Rules

MVP password rules:

- minimum 8 characters.

Later:

- stronger validation;
- password reset;
- email verification.

## File Upload Security

Validate uploads:

- allowed MIME types;
- file size limit;
- random file names;
- no executable files;
- do not trust original file name.

Allowed image types:

```txt
image/png
image/jpeg
image/webp
```

Allowed audio output:

```txt
audio/mpeg
audio/wav
```

## YouTube URL Security

Validate:

- URL format;
- max extract duration;
- start and end times;
- prevent command injection.

Never pass raw user input directly into shell commands.

Use subprocess safely with argument arrays.

## API Key Security

Never expose secret keys to frontend.

Sensitive keys:

- JWT secret;

They must stay in backend `.env`.

## WebSocket Security

Rules:

- host-only events must verify host identity;
- players cannot trigger host actions;
- players can only submit answers for their own player ID;
- reject answers when room is not active;
- reject answers for invalid slide IDs.

## Rate Limiting

Recommended later:

- auth route rate limit;
- audio processing rate limit;
- upload rate limit.

## CORS

Allow only frontend URL in production.

Development example:

```txt
http://localhost:5173
```

## Data Privacy

Store only required data.

Players without accounts should be stored by nickname and temporary ID.

## Important Security Rule

Do not trust frontend state.

The backend must verify:

- room status;
- current slide;
- host permissions;
- answer ownership;
- quiz ownership;
- file validity.
