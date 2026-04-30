# Features

## Authentication

Users can:

- register;
- login;
- logout;
- stay authenticated with JWT;
- access their own dashboard;
- create and save quizzes.

Optional later features:

- password reset;
- email verification;
- OAuth login.

## Quiz Dashboard

Authenticated users can:

- view their quizzes;
- create a quiz;
- edit a quiz;
- duplicate a quiz;
- delete a quiz;
- launch a quiz;
- view past sessions;
- view results.

## Quiz Editor

Users can create a quiz with:

- title;
- description;
- cover image;
- visibility;
- slides;
- global settings.

Each quiz contains slides.

Each slide has:

- type;
- title;
- question;
- media;
- answers;
- scoring settings;
- validation settings.

## Question Types

Supported or planned question types:

- single choice;
- text answer;
- blind test;
- image question;
- true/false;
- intro slide;
- pause slide.

## Live Room

A host can launch a quiz into a room.

The room provides:

- unique room code;
- join link;
- QR code;
- player list;
- host controls;
- current slide state;
- answer submission tracking.

## Player Join

Players can join by:

- room link;
- QR code;
- room code.

Players enter:

- nickname;
- optional avatar;
- optional account login.

## Live Gameplay

During gameplay:

- host displays each slide;
- players submit answers;
- server stores answers;
- host moves to next slide;
- answers are not revealed immediately.

## Reveal Phase

At the end of the quiz:

- host starts reveal mode;
- each slide is revealed one by one;
- submitted answers are displayed;
- correct answer is displayed;
- the host manually validates each answer;
- host can manually validate or override corrections;
- scores are updated.

## Scoring

Scoring supports:

- fixed points;
- partial points later;
- manual correction;
- AI-assisted correction;
- score recalculation after manual override.

Optional later feature:

- speed bonus.

## Participation History

Players can view previous participations.

A participation includes:

- quiz title;
- room/session;
- score;
- rank;
- answers;
- date.

## Leaderboards

The application provides:

- leaderboard per quiz;
- global leaderboard across all quizzes;
- optional leaderboard by user.

## Blind Test

The creator can add blind test slides.

The system supports:

- YouTube URL input;
- audio extraction;
- start and end timestamp;
- generated audio preview;
- answer configuration.

## Manual Correction

All answers are validated manually by the host during reveal.

## File Uploads

The system supports:

- quiz cover images;
- slide images;
- generated audio files;
- optional user avatars.

## QR Code Invitation

Each live room has:

- room code;
- public join URL;
- QR code generated from the join URL.
