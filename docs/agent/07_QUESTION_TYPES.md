# Question Types

## Goal

Question types must be modular.

Each slide has a `type` field that determines:

- editor UI;
- player answer UI;
- reveal display;
- manual validation during reveal.

## Important Rule

Every submitted answer is stored as a single string.

There is no multiple-choice answer payload and no AI correction.

The host validates each submitted answer manually during the reveal phase.

## Supported Types

```txt
single_choice
text_answer
blind_test
image_question
true_false
intro
pause
```

## Single Choice

The player selects exactly one answer.

The submitted answer is the selected answer ID as a string.

### Data

```json
{
  "type": "single_choice",
  "question": "string",
  "answers": [
    {
      "id": "a",
      "text": "string",
      "isCorrect": true
    }
  ]
}
```

## Text Answer

The player types an answer.

### Data

```json
{
  "type": "text_answer",
  "question": "string",
  "expectedAnswer": "string",
  "manualValidationRequired": true
}
```

### Validation

Validation is manual.

During reveal, the host sees the expected answer and each player answer, then marks each answer as correct or incorrect.

## Blind Test

The player listens to an audio extract and answers.

### Data

```json
{
  "type": "blind_test",
  "question": "Guess the song.",
  "audio": {
    "sourceUrl": "string",
    "storedFileUrl": "string",
    "startTime": 96,
    "endTime": 117
  },
  "answerMode": "text",
  "expectedAnswer": "string"
}
```

### Answer Modes

A blind test can use:

- text answer;
- single choice.

Both modes submit a string.

## Image Question

The player answers based on an image.

### Data

```json
{
  "type": "image_question",
  "question": "What is shown in this image?",
  "imageUrl": "string",
  "answerMode": "text | single_choice"
}
```

## True / False

The player chooses true or false.

The submitted answer is a string such as `true` or `false`.

### Data

```json
{
  "type": "true_false",
  "question": "string",
  "correctValue": true
}
```

## Intro Slide

A non-scored slide used to introduce a quiz section.

## Pause Slide

A non-scored slide used to create a break.

## Extensibility Rule

When adding a new question type, update:

- editor component;
- player answer component;
- reveal component;
- manual validation flow;
- data model documentation.
