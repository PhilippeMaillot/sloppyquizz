import type { RevealPayload } from '../../types/room'

type ScoreUpdateDisplayProps = {
  reveal: RevealPayload
  currentPlayerId: string
}

export function ScoreUpdateDisplay({ reveal, currentPlayerId }: ScoreUpdateDisplayProps) {
  const ownAnswer = reveal.answers.find((answer) => answer.playerId === currentPlayerId)
  if (!ownAnswer) {
    return null
  }

  if (ownAnswer.validation?.method === 'none') {
    return (
      <section className="score-update-card">
        <h3>Points</h3>
        <p>Le host n’a pas encore validé les points pour cette slide.</p>
      </section>
    )
  }

  return (
    <section className="score-update-card">
      <h3>Points</h3>
      <p>
        Résultat :{' '}
        <strong>{ownAnswer.isCorrect ? 'correct' : 'incorrect'}</strong> —{' '}
        <strong>+{ownAnswer.pointsAwarded ?? 0}</strong> points
      </p>
      <small>Méthode : {ownAnswer.validation?.method}</small>
    </section>
  )
}

