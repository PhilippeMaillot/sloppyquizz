import type { RevealedAnswer } from '../../types/room'
import { AnswerValidationRow } from './AnswerValidationRow'

type PlayerAnswersListProps = {
  answers: RevealedAnswer[]
  currentPlayerId?: string
  pointsForSlide?: number | null
  showActions?: boolean
  onMarkCorrect?: (answerId: string, pointsAwarded: number) => void
  onMarkIncorrect?: (answerId: string) => void
}

export function PlayerAnswersList({
  answers,
  currentPlayerId,
  pointsForSlide,
  showActions,
  onMarkCorrect,
  onMarkIncorrect,
}: PlayerAnswersListProps) {
  if (!answers.length) {
    return (
      <section className="player-answers-list">
        <h3>Réponses des joueurs</h3>
        <p>Aucune réponse envoyée pour cette question.</p>
      </section>
    )
  }

  return (
    <section className="player-answers-list">
      <h3>Réponses des joueurs</h3>
      <div className="revealed-answer-grid">
        {answers.map((answer) => (
          <AnswerValidationRow
            answer={answer}
            isOwnAnswer={answer.playerId === currentPlayerId}
            key={answer.answerId}
            onMarkCorrect={onMarkCorrect}
            onMarkIncorrect={onMarkIncorrect}
            pointsForSlide={pointsForSlide}
            showActions={showActions}
          />
        ))}
      </div>
    </section>
  )
}
