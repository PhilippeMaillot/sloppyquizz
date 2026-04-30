# Agent Instructions

## Role

You are an AI coding agent working on a full-stack quiz application.

Your job is to help design, implement, refactor, debug and document the project while respecting the architecture and product decisions described in this documentation.

## Main Objective

Build a web application that allows users to:

- create an account;
- create and save custom quizzes;
- build quizzes with multiple question types;
- launch quizzes in live rooms;
- allow players to join through a link or QR code;
- collect answers in real time using WebSockets;
- reveal answers only at the end of the quiz, one by one;
- calculate scores;
- store participations;
- display quiz-specific and global leaderboards.

## Required Technical Stack

Respect the following stack unless explicitly asked otherwise:

- Frontend: React
- Backend: Python with FastAPI
- Database: MongoDB
- Realtime: WebSocket or Socket.IO
- Blind test audio extraction: yt-dlp + ffmpeg
- Authentication: JWT + hashed passwords

## Important Product Rules

### Reveal Logic

Answers must not be revealed after each question during the live quiz.

The reveal phase happens only after all questions are completed.

During reveal:

1. the host reveals one question at a time;
2. player answers are displayed;
3. the correct answer is displayed;
4. points are validated;
5. the host moves to the next reveal step.

### Quiz Editor

The quiz editor must be flexible and support multiple slide/question types.

Each quiz is made of slides.

A slide can be:

- single choice;
- text answer;
- blind test;
- image-based question;
- true/false;
- intro or pause slide.

### Manual Validation

All submitted answers are stored as strings.

The host manually marks each answer as correct or incorrect during the reveal phase.

Do not use AI correction.

### Blind Test

For blind test slides:

- the creator can provide one or multiple YouTube links;
- the backend downloads/extracts audio with yt-dlp;
- the backend cuts the selected excerpt using ffmpeg;
- the extracted audio is stored on the server;
- the slide stores the path to the generated audio file;
- the host can play the audio during the live session.

## Coding Guidelines

- Keep code modular.
- Separate routes, services, models and WebSocket logic.
- Avoid putting business logic directly inside route handlers.
- Use clear naming.
- Keep frontend components small and focused.
- Store reusable UI elements in a components directory.
- Use environment variables for secrets.
- Never hardcode API keys.
- Validate all user inputs.
- Handle errors cleanly.
- Keep realtime state predictable.

## Data Integrity Rules

- A submitted answer must be linked to:
  - room;
  - quiz;
  - slide;
  - player;
  - timestamp.
- Scores must be recalculable.
- Manual corrections must update the final score.
- Participation history must be saved after the quiz ends.

## Agent Behavior

When implementing a feature:

1. read the relevant documentation file first;
2. identify impacted frontend, backend and database parts;
3. implement the smallest coherent version first;
4. keep the architecture extensible;
5. avoid breaking existing features;
6. document important decisions when needed.

## Priority

If there is a conflict between files, follow this order:

1. `00_AGENT_INSTRUCTIONS.md`
2. `01_PROJECT_OVERVIEW.md`
3. feature-specific documentation
4. implementation details
# Agent Instructions

## Role

You are an AI coding agent working on a full-stack quiz application.

Your job is to help design, implement, refactor, debug and document the project while respecting the architecture and product decisions described in this documentation.

## Main Objective

Build a web application that allows users to:

- create an account;
- create and save custom quizzes;
- build quizzes with multiple question types;
- launch quizzes in live rooms;
- allow players to join through a link or QR code;
- collect answers in real time using WebSockets;
- reveal answers only at the end of the quiz, one by one;
- calculate scores;
- store participations;
- display quiz-specific and global leaderboards.

## Required Technical Stack

Respect the following stack unless explicitly asked otherwise:

- Frontend: React
- Backend: Python with FastAPI
- Database: MongoDB
- Realtime: WebSocket or Socket.IO
- Blind test audio extraction: yt-dlp + ffmpeg
- Authentication: JWT + hashed passwords

## Important Product Rules

### Reveal Logic

Answers must not be revealed after each question during the live quiz.

The reveal phase happens only after all questions are completed.

During reveal:

1. the host reveals one question at a time;
2. player answers are displayed;
3. the correct answer is displayed;
4. points are validated;
5. the host moves to the next reveal step.

### Quiz Editor

The quiz editor must be flexible and support multiple slide/question types.

Each quiz is made of slides.

A slide can be:

- single choice;
- text answer;
- blind test;
- image-based question;
- true/false;
- intro or pause slide.

### Manual Validation

All submitted answers are stored as strings.

The host manually marks each answer as correct or incorrect during the reveal phase.

Do not use AI correction.

### Blind Test

For blind test slides:

- the creator can provide one or multiple YouTube links;
- the backend downloads/extracts audio with yt-dlp;
- the backend cuts the selected excerpt using ffmpeg;
- the extracted audio is stored on the server;
- the slide stores the path to the generated audio file;
- the host can play the audio during the live session.

## Coding Guidelines

- Keep code modular.
- Separate routes, services, models and WebSocket logic.
- Avoid putting business logic directly inside route handlers.
- Use clear naming.
- Keep frontend components small and focused.
- Store reusable UI elements in a components directory.
- Use environment variables for secrets.
- Never hardcode API keys.
- Validate all user inputs.
- Handle errors cleanly.
- Keep realtime state predictable.

## Data Integrity Rules

- A submitted answer must be linked to:
  - room;
  - quiz;
  - slide;
  - player;
  - timestamp.
- Scores must be recalculable.
- Manual corrections must update the final score.
- Participation history must be saved after the quiz ends.

## Agent Behavior

When implementing a feature:

1. read the relevant documentation file first;
2. identify impacted frontend, backend and database parts;
3. implement the smallest coherent version first;
4. keep the architecture extensible;
5. avoid breaking existing features;
6. document important decisions when needed.

## Priority

If there is a conflict between files, follow this order:

1. `00_AGENT_INSTRUCTIONS.md`
2. `01_PROJECT_OVERVIEW.md`
3. feature-specific documentation
4. implementation details
