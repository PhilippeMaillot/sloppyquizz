# Quiz Editor

## Goal

The quiz editor allows authenticated users to create and edit quizzes composed of multiple slides.

The editor must be flexible enough to support many question types.

## Editor Layout

Recommended layout:

```txt
┌─────────────────────────────────────────────┐
│ Top bar: quiz title, save button, preview   │
├───────────────┬─────────────────────────────┤
│ Slide list    │ Current slide editor        │
│               │                             │
│ Slide 1       │ Question fields             │
│ Slide 2       │ Answer fields               │
│ Slide 3       │ Media fields                │
│ + Add slide   │ Settings                    │
└───────────────┴─────────────────────────────┘
```

Optional third panel:

```txt
Right panel: slide settings
```

## Quiz-Level Fields

A quiz has:

- title;
- description;
- cover image;
- visibility;
- global settings.

## Global Settings

Possible settings:

```json
{
  "revealMode": "end_only",
  "allowLateJoin": false,
  "manualValidation": true,
  "shuffleQuestions": false,
  "shuffleAnswers": false
}
```

## Slide List

The slide list allows the creator to:

- add a slide;
- select a slide;
- duplicate a slide;
- delete a slide;
- reorder slides;
- see the type of each slide.

## Slide Creation

When adding a slide, the user chooses a type:

- single choice;
- text answer;
- blind test;
- image question;
- true/false;
- intro;
- pause.

## Slide Editor

The slide editor must render different forms depending on the selected slide type.

Example:

```txt
If type = text_answer
→ show expected answer input. Validation is manual during reveal.

If type = blind_test
→ show YouTube URL, timestamp fields and audio preview.
```

## Autosave

Autosave can be added later.

For MVP, use explicit save button.

Recommended behavior:

- user edits quiz locally;
- user clicks Save;
- frontend sends full quiz document or partial update;
- backend validates and stores it.

## Validation Rules

Before saving a quiz:

- title must not be empty;
- quiz must have at least one slide;
- each question slide must have a question;
- QCM must have at least two answers;
- QCM must have at least one correct answer;
- text answer must have an expected answer;
- blind test must have audio configured.

## Preview Mode

The creator should be able to preview the quiz before launching.

Preview does not create a room.

Preview only displays slides as they would appear in presentation mode.

## UX Style

The editor should feel playful but practical.

Recommended UI:

- cards;
- colored badges for question types;
- big add button;
- drag-and-drop slide list later;
- clear empty states;
- inline validation errors;
- friendly labels.
