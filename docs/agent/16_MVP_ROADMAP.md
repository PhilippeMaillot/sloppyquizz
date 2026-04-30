# MVP Roadmap

## Goal

Build the project step by step without trying to implement every advanced feature at once.

The first goal is to get a playable live quiz system working.

## Phase 1 — Project Setup

### Backend

- initialize FastAPI project;
- connect MongoDB;
- configure environment variables;
- create base folder structure;
- configure CORS;
- create health check route.

### Frontend

- initialize React project;
- configure router;
- create base layout;
- create API client;
- create basic styling system.

## Phase 2 — Authentication

Backend:

- register route;
- login route;
- JWT generation;
- password hashing;
- current user route.

Frontend:

- register page;
- login page;
- auth store;
- protected routes.

## Phase 3 — Quiz CRUD

Backend:

- create quiz;
- get user quizzes;
- get one quiz;
- update quiz;
- delete quiz.

Frontend:

- dashboard;
- quiz list;
- create quiz button;
- edit quiz page;
- save quiz.

## Phase 4 — Basic Quiz Editor

Implement first question types:

- single choice;
- text answer.

Editor features:

- add slide;
- delete slide;
- select slide;
- edit question;
- edit answers;
- set correct answer;
- save quiz.

## Phase 5 — Live Room MVP

Backend:

- create room;
- generate room code;
- basic room state;
- WebSocket room manager.

Frontend:

- host room page;
- join room page;
- player room page;
- display player list;
- start quiz;
- show current slide.

## Phase 6 — Answer Submission

Backend:

- receive answer through WebSocket;
- validate room state;
- store answer;
- notify host that answer was submitted.

Frontend:

- player answer form;
- answer submitted state;
- host answer count.

## Phase 7 — End-Only Reveal

Backend:

- start reveal phase;
- reveal slide by slide;
- calculate basic scores;
- validate points.

Frontend:

- reveal screen;
- display player answers;
- display correct answer;
- host next reveal button;
- scoreboard.

## Phase 8 — Save Participations

Backend:

- calculate final scores;
- create participation records;
- update user stats;
- create quiz leaderboard.

Frontend:

- final results page;
- player result page;
- quiz leaderboard page.

## Phase 9 — Blind Test

Backend:

- install yt-dlp;
- install ffmpeg;
- create audio processing route;
- store generated audio;
- add blind test slide validation.

Frontend:

- blind test editor;
- YouTube URL input;
- start/end timestamp fields;
- process audio button;
- audio preview;
- blind test live display.

## Phase 10 — Global Leaderboard

Backend:

- aggregate total points;
- create global leaderboard route.

Frontend:

- global leaderboard page;
- user ranking display.

## Recommended MVP Scope

The real MVP should include:

```txt
- auth
- quiz creation
- QCM
- text answers
- live rooms
- WebSocket answer submission
- end-only reveal
- manual scoring
- final scoreboard
```

Do not add AI correction.

They should come after the core quiz loop works.

## Priority Order

```txt
1. Auth
2. Quiz CRUD
3. Quiz editor
4. Live room
5. Answer submission
6. Reveal phase
7. Scoring
8. Participations
9. Blind test
10. Leaderboards
```

## Development Advice

Always build a small complete feature before adding complexity.

Example:

Do not build every question type first.

Instead:

1. build one question type;
2. make it playable live;
3. reveal and score it;
4. then add more types.

## Success Criteria

The MVP is successful when:

- a user can create an account;
- create a quiz with several questions;
- launch a live room;
- players can join with a code;
- players can answer;
- answers stay hidden during the quiz;
- host reveals answers at the end;
- scores are calculated;
- final ranking is displayed;
- participation is saved.
