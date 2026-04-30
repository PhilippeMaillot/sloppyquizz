# Reveal and Scoring

## Main Rule

Answers are revealed only at the end of the quiz.

Do not reveal correctness after each question during gameplay.

## Reveal Flow

After the last question:

1. host starts reveal phase;
2. server sets room status to `REVEAL_PHASE`;
3. host reveals slide 1;
4. player answers are displayed;
5. correct answer is displayed;
6. points are calculated or reviewed;
7. host confirms validation;
8. host moves to next slide reveal;
9. repeat until all slides are revealed;
10. final scoreboard is displayed;
11. participation records are saved.

## Reveal Controls

Host should have buttons such as:

```txt
Start reveal
Reveal player answers
Reveal correct answer
Validate points
Next reveal
Finish quiz
```

## Scoring Rules

Each slide has a base point value.

Example:

```json
{
  "points": 100
}
```

## Scoring Validation

Scoring is manual.

During reveal, the host marks every submitted answer as correct or incorrect.

## Single Choice Scoring

Correct answer:

```txt
+ slide.points
```

Wrong answer:

```txt
+ 0
```

## Multiple Choice Scoring

MVP rule:

```txt
Player must select exactly all correct answers.
```

Correct:

```txt
+ slide.points
```

Wrong:

```txt
+ 0
```

Partial scoring can be added later.

## Text Answer Scoring

Text answers follow this order:

1. exact normalized match;
2. accepted aliases;
3. manual host validation.

## Blind Test Scoring

Blind test scoring depends on answer mode.

If answer mode is text:

- use text answer scoring.

If answer mode is choice:

- use choice scoring.

## Manual Validation

The host can override any answer.

Manual validation should update:

- `isCorrect`;
- `pointsAwarded`;
- `validation.method`;
- `validation.validatedBy`.

Example:

```json
{
  "isCorrect": true,
  "pointsAwarded": 100,
  "validation": {
    "method": "manual",
    "validatedBy": "host_user_id"
  }
}
```

## Score Recalculation

Scores must be recalculable from submitted answers.

Do not rely only on a stored total score.

A player's score should be:

```txt
sum(pointsAwarded for all validated answers)
```

## Final Scoreboard

At the end of the reveal phase:

1. calculate final scores;
2. sort players by score descending;
3. assign ranks;
4. save participations;
5. update leaderboards.

## Tie Handling

MVP rule:

- same score can share same rank or be ordered by submission speed.

Recommended MVP:

```txt
Same score = same rank.
```

## Participation Saving

After finishing the quiz, create a participation record for each player.

Each participation stores:

- quiz ID;
- room ID;
- player ID;
- user ID if logged in;
- nickname;
- final score;
- rank;
- answers;
- played date.

## Important UI Rule

Players should not see their final score until the host finishes validation or reveal.
