import type { RevealedAnswer } from '../../types/room'

type AnswerValidationRowProps = {
  answer: RevealedAnswer
  isOwnAnswer?: boolean
  pointsForSlide?: number | null
  showActions?: boolean
  onMarkCorrect?: (answerId: string) => void
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

function formatMethodLabel(method?: string) {
  if (!method || method === 'none') {
    return 'non validé'
  }
  if (method === 'auto') {
    return 'validation automatique héritée'
  }
  if (method === 'ai') {
    return 'validation héritée'
  }
  if (method === 'manual_required') {
    return 'à vérifier'
  }
  if (method === 'manual') {
    return 'corrigé manuellement'
  }
  return method
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
  const methodLabel = formatMethodLabel(method)
  const confidence =
    typeof answer.validation?.confidence === 'number'
      ? Math.round(answer.validation.confidence * 100)
      : null
  const reason = answer.validation?.reason ?? null

  return (
    <article className={isOwnAnswer ? 'validation-row validation-row-own' : 'validation-row'}>
      <div className="validation-row-main">
        <span className="validation-row-player">{answer.nickname}</span>
        <strong className="validation-row-answer">{answer.answer}</strong>
      </div>

      <div className="validation-row-meta">
        <span className="validation-row-status">{status}</span>
        <span className={`validation-row-badge validation-row-badge-${method ?? 'none'}`}>
          {methodLabel}
        </span>
        {confidence !== null ? (
          <span className="validation-row-confidence">{confidence}%</span>
        ) : null}
        <strong className="validation-row-points">
          +{awarded}
          {typeof maxPoints === 'number' ? ` / ${maxPoints}` : ''}
        </strong>
      </div>

      {reason ? <small className="validation-row-reason">{reason}</small> : null}

      {showActions ? (
        <div className="validation-row-actions">
          <button
            className="primary-button"
            onClick={() => onMarkCorrect?.(answer.answerId)}
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
