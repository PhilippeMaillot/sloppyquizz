# Data Models

## MongoDB Collections

Main collections:

```txt
users
quizzes
rooms
participations
```

Optional collections:

```txt
uploaded_files
leaderboard_entries
audio_jobs
```

## User

```json
{
  "_id": "ObjectId",
  "username": "string",
  "email": "string",
  "passwordHash": "string",
  "avatarUrl": "string | null",
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "stats": {
    "totalPoints": 0,
    "quizzesCreated": 0,
    "quizzesPlayed": 0,
    "wins": 0
  }
}
```

## Quiz

```json
{
  "_id": "ObjectId",
  "creatorId": "ObjectId",
  "title": "string",
  "description": "string",
  "coverImageUrl": "string | null",
  "visibility": "private | public",
  "slides": [],
  "settings": {
    "revealMode": "end_only",
    "allowLateJoin": false,
    "manualValidation": true,
    "shuffleQuestions": false,
    "shuffleAnswers": false
  },
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

## Slide Base Model

Every slide should share a base structure.

```json
{
  "id": "string",
  "type": "single_choice | text_answer | blind_test | image_question | true_false | intro | pause",
  "title": "string",
  "question": "string | null",
  "description": "string | null",
  "imageUrl": "string | null",
  "points": 100,
  "order": 0
}
```

## Single Choice Slide

```json
{
  "id": "slide_2",
  "type": "single_choice",
  "title": "Question 2",
  "question": "Choose one answer.",
  "answers": [
    {
      "id": "a",
      "text": "Answer A",
      "isCorrect": true
    },
    {
      "id": "b",
      "text": "Answer B",
      "isCorrect": false
    }
  ],
  "points": 100
}
```

## Text Answer Slide

```json
{
  "id": "slide_3",
  "type": "text_answer",
  "title": "Question 3",
  "question": "Who painted the Mona Lisa?",
  "expectedAnswer": "Leonardo da Vinci",
  "manualValidationRequired": true,
  "points": 100
}
```

## Blind Test Slide

```json
{
  "id": "slide_4",
  "type": "blind_test",
  "title": "Blind Test",
  "question": "Guess the song.",
  "audio": {
    "sourceType": "youtube",
    "sourceUrl": "https://youtube.com/example",
    "storedFileUrl": "/uploads/audio/quiz_123_slide_4.mp3",
    "startTime": 96,
    "endTime": 117,
    "duration": 21
  },
  "answerMode": "text | single_choice",
  "expectedAnswer": "Billie Jean",
  "answers": [],
  "points": 100
}
```

## Room

```json
{
  "_id": "ObjectId",
  "quizId": "ObjectId",
  "hostId": "ObjectId",
  "code": "ABC123",
  "status": "WAITING_ROOM | QUESTION_ACTIVE | QUESTION_LOCKED | REVEAL_PHASE | FINISHED",
  "currentSlideIndex": 0,
  "players": [],
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "finishedAt": "datetime | null"
}
```

## Room Player

```json
{
  "playerId": "string",
  "userId": "ObjectId | null",
  "nickname": "string",
  "avatarUrl": "string | null",
  "score": 0,
  "connected": true,
  "joinedAt": "datetime"
}
```

## Submitted Answer

Submitted answers can be stored inside a room during MVP or in a separate collection later.

```json
{
  "answerId": "string",
  "roomId": "ObjectId",
  "quizId": "ObjectId",
  "slideId": "string",
  "playerId": "string",
  "userId": "ObjectId | null",
  "answer": "string",
  "submittedAt": "datetime",
  "isCorrect": "boolean | null",
  "pointsAwarded": 0,
  "validation": {
    "method": "manual | manual_required | none",
    "confidence": null,
    "reason": "string | null",
    "validatedBy": "ObjectId | null"
  }
}
```

## Participation

A participation is created when a room is finished.

```json
{
  "_id": "ObjectId",
  "quizId": "ObjectId",
  "roomId": "ObjectId",
  "userId": "ObjectId | null",
  "nickname": "string",
  "score": 850,
  "rank": 2,
  "answers": [],
  "playedAt": "datetime"
}
```

## Leaderboard Entry

```json
{
  "_id": "ObjectId",
  "scope": "quiz | global",
  "quizId": "ObjectId | null",
  "userId": "ObjectId | null",
  "nickname": "string",
  "score": 850,
  "bestScore": 1200,
  "totalPoints": 5200,
  "quizzesPlayed": 12,
  "updatedAt": "datetime"
}
```
