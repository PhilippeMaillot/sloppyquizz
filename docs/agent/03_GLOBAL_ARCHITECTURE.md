# Global Architecture

## Overview

The application is divided into three major parts:

```txt
Frontend React
    ↓ REST API + WebSocket
Backend FastAPI
    ↓
MongoDB + File Storage
```

## Main Responsibilities

### Frontend

The frontend handles:

- authentication screens;
- quiz dashboard;
- quiz editor;
- live host presentation;
- player join screen;
- player answer screen;
- reveal UI;
- leaderboards;
- participation history.

### Backend

The backend handles:

- authentication;
- quiz CRUD;
- room creation;
- WebSocket events;
- answer storage;
- scoring;
- audio processing;
- file upload;
- leaderboard calculation.

### MongoDB

MongoDB stores:

- users;
- quizzes;
- rooms;
- submitted answers;
- participations;
- scores;
- leaderboard data.

### File Storage

The server stores:

- uploaded images;
- generated audio extracts;
- optional avatars;
- optional quiz covers.

In MVP, storage can be local.

Later, it can be moved to S3, MinIO or another object storage provider.

## Logical Modules

```txt
auth
quiz
slides
rooms
websocket
answers
reveal
scoring
ai_correction
audio_processing
leaderboards
uploads
```

## Request Types

The application uses two communication methods.

### REST API

Used for persistent actions:

- create account;
- login;
- create quiz;
- update quiz;
- upload image;
- process blind test audio;
- fetch leaderboard;
- fetch participation history.

### WebSocket

Used for live interactions:

- join room;
- start quiz;
- move to next slide;
- submit answer;
- update player list;
- lock answers;
- start reveal;
- reveal next answer;
- update scores;
- finish quiz.

## Room Architecture

A room represents a live session of a quiz.

A quiz can exist permanently.

A room is temporary and based on a quiz.

```txt
Quiz
 └── Room
      ├── Host
      ├── Players
      ├── Current slide
      ├── Submitted answers
      ├── Reveal state
      └── Scores
```

## State Management

The live state should exist in memory during the game, but important data must be persisted in MongoDB.

Important persistent data:

- room creation;
- players;
- submitted answers;
- final scores;
- final participation records.

Temporary data:

- socket connection IDs;
- current connected status;
- transient UI state.

## Suggested Backend Layers

```txt
routes/
    REST endpoints

services/
    business logic

models/
    Pydantic schemas

database/
    MongoDB connection

websocket/
    live room manager and events

utils/
    helper functions
```

## Suggested Frontend Layers

```txt
pages/
    route-level screens

components/
    reusable UI components

features/
    feature-specific logic

services/
    API and socket clients

stores/
    global state

types/
    shared TypeScript types
```

## Scalability Notes

For the first version, one backend instance can store live rooms in memory.

For future scaling, live room state may need to be moved to:

- Redis;
- a dedicated game/session service;
- a distributed pub/sub system.

Do not over-engineer this for the MVP.
