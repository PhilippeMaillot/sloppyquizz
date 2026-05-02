import { useEffect, useState } from 'react'

import type { RevealedAnswer } from '../../types/room'

type AnswerValidationRowProps = {
  answer: RevealedAnswer
  isOwnAnswer?: boolean
  pointsForSlide?: number | null
  showActions?: boolean
  onMarkCorrect?: (answerId: string, pointsAwarded: number) => void
  onMarkIncorrect?: (answerId: string) => void
}

function formatStatus(answer: RevealedAnswer) {
  if (answer.validation?.method === 'manual_required') {
    return 'À vérifier'
  }
  if (answer.validation?.method === 'none') {
    return 'Non validé'
  }
  if (answer.isCorrect === true) {
    return 'Correct'
  }
  if (answer.isCorrect === false) {
    return 'Incorrect'
  }
  return 'Non validé'
}

export function AnswerValidationRow({
  answer,
  isOwnAnswer,
  pointsForSlide,
  showActions,
  onMarkCorrect,
  onMarkIncorrect,
}: AnswerValidationRowProps) {
  const status = formatStatus(answer)
  const awarded = answer.pointsAwarded ?? 0
  const maxPoints = pointsForSlide ?? undefined
  const method = answer.validation?.method
  const [draftPoints, setDraftPoints] = useState(
    String(method === 'manual' ? awarded : (pointsForSlide ?? awarded ?? 0)),
  )

  useEffect(() => {
    setDraftPoints(String(answer.validation?.method === 'manual' ? awarded : (pointsForSlide ?? awarded ?? 0)))
  }, [answer.validation?.method, awarded, pointsForSlide])

  function parseDraftPoints() {
    const parsed = Number(draftPoints.replace(',', '.'))
    if (!Number.isFinite(parsed)) {
      return 0
    }
    const bounded = Math.max(0, parsed)
    return typeof maxPoints === 'number' ? Math.min(bounded, maxPoints) : bounded
  }

  return (
    <article className={isOwnAnswer ? 'validation-row validation-row-own' : 'validation-row'}>
      <div className="validation-row-main">
        <span className="validation-row-player">{answer.nickname}</span>
        <strong className="validation-row-answer">{answer.answer}</strong>
      </div>

      <div className="validation-row-meta">
        <span className="validation-row-status">{status}</span>
        <strong className="validation-row-points">
          +{awarded}
          {typeof maxPoints === 'number' ? ` / ${maxPoints}` : ''}
        </strong>
      </div>

      {showActions ? (
        <div className="validation-row-actions">
          <label className="validation-points-field">
            Points
            <input
              max={maxPoints}
              min={0}
              onChange={(event) => setDraftPoints(event.target.value)}
              step="0.5"
              type="number"
              value={draftPoints}
            />
          </label>
          <button
            className="primary-button"
            onClick={() => onMarkCorrect?.(answer.answerId, parseDraftPoints())}
            type="button"
          >
            Valider
          </button>
          <button
            className="danger-button"
            onClick={() => onMarkIncorrect?.(answer.answerId)}
            type="button"
          >
            Refuser
          </button>
        </div>
      ) : null}
    </article>
  )
}
