# Project Overview

## Project Name

The project is a full-stack web application for creating, hosting and playing interactive quizzes.

The final name is not fixed yet.

## Concept

The application allows users to create highly customizable quizzes and launch them in live rooms.

Players join the quiz from their own device using a room link or QR code.

The quiz is controlled by a host in presentation mode.

Unlike traditional quiz apps, answers are not revealed immediately after each question. Instead, all answers are revealed at the end of the quiz, question by question, controlled by the host.

## Inspiration

The UI should feel playful, colorful and simple, with an atmosphere close to Gartic Phone:

- rounded cards;
- big buttons;
- colorful interface;
- fun transitions;
- accessible UX;
- light and friendly visual identity.

The application should not copy Gartic Phone directly, but can be inspired by its playful mood.

## Main User Types

### Quiz Creator / Host

The creator can:

- create an account;
- create quizzes;
- edit quizzes;
- add slides/questions;
- configure question types;
- upload images;
- create blind test slides;
- launch a quiz room;
- control the live quiz;
- reveal answers at the end;
- validate scores manually;
- view results and rankings.

### Player

The player can:

- join a room through a link or QR code;
- choose a nickname;
- answer quiz questions;
- wait during the reveal phase;
- see their score at the end;
- view their participation history if logged in;
- appear in quiz-specific and global leaderboards.

## Core Flow

1. A user creates an account.
2. The user creates a quiz.
3. The quiz is composed of multiple slides.
4. Each slide has a question type.
5. The user saves the quiz.
6. The user launches the quiz.
7. A live room is created.
8. Players join the room.
9. The host starts the quiz.
10. Players answer each question.
11. No answer is revealed during the question phase.
12. At the end, the host starts the reveal phase.
13. Answers are revealed one by one.
14. Scores are calculated and validated.
15. Results are saved.
16. Leaderboards are updated.

## Main Modules

The application is divided into these main modules:

- authentication;
- quiz editor;
- question type system;
- live rooms;
- WebSocket communication;
- reveal system;
- scoring system;
- blind test audio processing;
- participation history;
- leaderboards.

## Main Technical Goals

The project should be:

- modular;
- scalable;
- easy to extend with new question types;
- suitable for real-time multiplayer sessions;
- easy to deploy with Docker later;
- maintainable by an AI coding agent.
# Project Overview

## Project Name

The project is a full-stack web application for creating, hosting and playing interactive quizzes.

The final name is not fixed yet.

## Concept

The application allows users to create highly customizable quizzes and launch them in live rooms.

Players join the quiz from their own device using a room link or QR code.

The quiz is controlled by a host in presentation mode.

Unlike traditional quiz apps, answers are not revealed immediately after each question. Instead, all answers are revealed at the end of the quiz, question by question, controlled by the host.

## Inspiration

The UI should feel playful, colorful and simple, with an atmosphere close to Gartic Phone:

- rounded cards;
- big buttons;
- colorful interface;
- fun transitions;
- accessible UX;
- light and friendly visual identity.

The application should not copy Gartic Phone directly, but can be inspired by its playful mood.

## Main User Types

### Quiz Creator / Host

The creator can:

- create an account;
- create quizzes;
- edit quizzes;
- add slides/questions;
- configure question types;
- upload images;
- create blind test slides;
- launch a quiz room;
- control the live quiz;
- reveal answers at the end;
- validate scores manually;
- view results and rankings.

### Player

The player can:

- join a room through a link or QR code;
- choose a nickname;
- answer quiz questions;
- wait during the reveal phase;
- see their score at the end;
- view their participation history if logged in;
- appear in quiz-specific and global leaderboards.

## Core Flow

1. A user creates an account.
2. The user creates a quiz.
3. The quiz is composed of multiple slides.
4. Each slide has a question type.
5. The user saves the quiz.
6. The user launches the quiz.
7. A live room is created.
8. Players join the room.
9. The host starts the quiz.
10. Players answer each question.
11. No answer is revealed during the question phase.
12. At the end, the host starts the reveal phase.
13. Answers are revealed one by one.
14. Scores are calculated and validated.
15. Results are saved.
16. Leaderboards are updated.

## Main Modules

The application is divided into these main modules:

- authentication;
- quiz editor;
- question type system;
- live rooms;
- WebSocket communication;
- reveal system;
- scoring system;
- blind test audio processing;
- participation history;
- leaderboards.

## Main Technical Goals

The project should be:

- modular;
- scalable;
- easy to extend with new question types;
- suitable for real-time multiplayer sessions;
- easy to deploy with Docker later;
- maintainable by an AI coding agent.
