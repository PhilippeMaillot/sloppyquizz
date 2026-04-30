# Live Rooms and WebSocket

## Goal

Live rooms allow a host to run a quiz session in real time.

Players join the room and answer questions from their devices.

## Room Creation

When the host launches a quiz:

1. backend creates a room;
2. backend generates a unique room code;
3. backend stores the room;
4. frontend displays room link and QR code.

Example:

```txt
Room code: ABC123
Join URL: /join/ABC123
```

## Room States

```txt
WAITING_ROOM
QUESTION_ACTIVE
QUESTION_LOCKED
REVEAL_PHASE
FINISHED
```

## Room State Details

### WAITING_ROOM

Players can join.

Host can start the quiz.

### QUESTION_ACTIVE

A slide is active.

Players can submit answers.

### QUESTION_LOCKED

Answers are locked.

Players can no longer submit answers for the current slide.

### REVEAL_PHASE

The quiz is over.

The host reveals answers one by one.

### FINISHED

Final scores are saved.

The room is completed.

## WebSocket Events

## Client to Server: Host Events

```txt
host:start_quiz
host:next_slide
host:lock_answers
host:start_reveal
host:reveal_slide
host:validate_answer
host:finish_quiz
```

## Client to Server: Player Events

```txt
player:join_room
player:submit_answer
player:leave_room
```

## Server to Clients Events

```txt
room:state_updated
room:player_joined
room:player_left
quiz:slide_started
quiz:answer_submitted
quiz:answers_locked
quiz:reveal_started
quiz:slide_revealed
quiz:score_updated
quiz:finished
error
```

## Player Join Payload

```json
{
  "roomCode": "ABC123",
  "nickname": "Player 1",
  "userId": null
}
```

## Submit Answer Payload

```json
{
  "roomCode": "ABC123",
  "slideId": "slide_1",
  "playerId": "player_1",
  "answer": "string or array"
}
```

## Host Next Slide Payload

```json
{
  "roomCode": "ABC123"
}
```

## Server Slide Started Payload

```json
{
  "slide": {
    "id": "slide_1",
    "type": "single_choice",
    "title": "Question 1",
    "question": "Example question"
  },
  "currentSlideIndex": 0,
  "totalSlides": 10
}
```

## Important Rules

- Only the host can start the quiz.
- Only the host can move to the next slide.
- Only the host can start reveal mode.
- Players can only answer during `QUESTION_ACTIVE`.
- Players cannot modify answers after lock unless explicitly allowed.
- Answers must not reveal correctness before reveal phase.

## Connection Handling

The backend should track:

- socket ID;
- player ID;
- room code;
- connected status.

If a player disconnects:

- mark player as disconnected;
- keep their submitted answers;
- allow reconnection if possible.

## Room Manager

The backend should have a room manager responsible for:

- active rooms;
- socket connections;
- room membership;
- broadcasting events;
- updating room state;
- storing submitted answers.

Suggested file:

```txt
backend/websocket/room_manager.py
```

## MVP Simplification

For MVP, live room state can be kept in memory and persisted when needed.

Later, Redis can be added for scaling.
