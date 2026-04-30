import type { CorrectAnswerPayload } from '../../types/room'

type CorrectAnswerDisplayProps = {
  correctAnswer: CorrectAnswerPayload
}

export function CorrectAnswerDisplay({ correctAnswer }: CorrectAnswerDisplayProps) {
  const choiceAnswers = correctAnswer.answers ?? []

  return (
    <section className="correct-answer-card">
      <span>Correct answer</span>

      {choiceAnswers.length ? (
        <div className="correct-answer-list">
          {choiceAnswers.map((answer) => (
            <strong key={answer.id}>{answer.text}</strong>
          ))}
        </div>
      ) : null}

      {correctAnswer.expectedAnswer ? (
        <div className="correct-answer-list">
          <strong>{correctAnswer.expectedAnswer}</strong>
        </div>
      ) : null}

      {!choiceAnswers.length && !correctAnswer.expectedAnswer ? (
        <p>No configured correct answer for this slide type yet.</p>
      ) : null}
    </section>
  )
}
