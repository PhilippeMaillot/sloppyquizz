# Frontend Structure

## Framework

The frontend uses React.

TypeScript is recommended.

## Suggested Folder Structure

```txt
frontend/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── router.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── QuizEditorPage.tsx
│   │   ├── QuizPreviewPage.tsx
│   │   ├── HostRoomPage.tsx
│   │   ├── JoinRoomPage.tsx
│   │   ├── PlayerRoomPage.tsx
│   │   ├── ResultsPage.tsx
│   │   └── LeaderboardPage.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── quiz/
│   │   ├── editor/
│   │   ├── room/
│   │   └── leaderboard/
│   ├── features/
│   │   ├── auth/
│   │   ├── quizzes/
│   │   ├── editor/
│   │   ├── rooms/
│   │   ├── reveal/
│   │   └── leaderboard/
│   ├── services/
│   │   ├── apiClient.ts
│   │   ├── authApi.ts
│   │   ├── quizApi.ts
│   │   ├── roomApi.ts
│   │   ├── uploadApi.ts
│   │   └── socketClient.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── quizEditorStore.ts
│   │   └── roomStore.ts
│   ├── types/
│   │   ├── auth.ts
│   │   ├── quiz.ts
│   │   ├── room.ts
│   │   └── answer.ts
│   ├── utils/
│   └── main.tsx
```

## Pages

### LoginPage

Allows users to log in.

### RegisterPage

Allows users to create an account.

### DashboardPage

Displays user quizzes and quick actions.

### QuizEditorPage

Main quiz creation interface.

### QuizPreviewPage

Displays a non-live preview of the quiz.

### HostRoomPage

Used by the host to control a live quiz.

### JoinRoomPage

Allows players to join with a room code or link.

### PlayerRoomPage

Player interface for answering questions.

### ResultsPage

Displays final results and participation data.

### LeaderboardPage

Displays global or quiz-specific leaderboard.

## Important Components

### QuizEditor

Handles the full quiz editing UI.

### SlideList

Displays slides in order.

### SlideEditor

Renders the correct editor based on slide type.

### QuestionTypeSelector

Allows creator to choose slide type.

### AnswerEditor

Allows editing QCM answers.

### BlindTestEditor

Handles YouTube URL, timestamps and audio preview.

### HostControls

Allows host to start, lock, reveal and finish quiz.

### PlayerAnswerForm

Renders answer UI based on slide type.

### RevealPanel

Displays answers and scoring during reveal.

### Scoreboard

Displays scores.

### QRCodeDisplay

Displays room QR code.

## State Management

Recommended stores:

### Auth Store

Stores:

- current user;
- access token;
- authentication status.

### Quiz Editor Store

Stores:

- current quiz draft;
- selected slide;
- unsaved changes.

### Room Store

Stores:

- room state;
- current slide;
- player data;
- submitted answer status;
- reveal state.

## API Client

Use a centralized API client.

Suggested file:

```txt
src/services/apiClient.ts
```

Responsibilities:

- base URL;
- authorization header;
- error handling.

## Socket Client

Suggested file:

```txt
src/services/socketClient.ts
```

Responsibilities:

- connect to backend;
- emit events;
- listen to events;
- disconnect cleanly.

## Styling

The UI should be playful and colorful.

Recommended style:

- rounded cards;
- pastel or bright colors;
- large readable text;
- clear buttons;
- fun but clean animations;
- responsive layout.

## Responsiveness

The app must support:

- desktop host screen;
- mobile player screen.

Priority:

1. player mobile experience;
2. host desktop experience;
3. editor desktop experience.
