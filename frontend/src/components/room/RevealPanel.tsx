import { useMemo } from 'react'
import type { RevealPayload } from '../../types/room'
import { CorrectAnswerDisplay } from './CorrectAnswerDisplay'
import { PlayerAnswersList } from './PlayerAnswersList'
import { RevealedSlide } from './RevealedSlide'

type RevealPanelProps = {
  reveal: RevealPayload
  currentPlayerId?: string
  isHost?: boolean
  onOverrideAnswer?: (answerId: string, isCorrect: boolean) => void
}

export function RevealPanel({
  reveal,
  currentPlayerId,
  isHost,
  onOverrideAnswer,
}: RevealPanelProps) {
  const answerIdToLabel = useMemo(() => {
    const map = new Map<string, string>()
    for (const choice of reveal.slide.answers ?? []) {
      if (choice?.id && choice?.text) {
        map.set(String(choice.id), String(choice.text))
      }
    }
    return map
  }, [reveal.slide.answers])

  const sortedAnswers = useMemo(() => {
    return [...reveal.answers].sort((a, b) => (a.nickname || '').localeCompare(b.nickname || ''))
  }, [reveal.answers])

  const answersForDisplay = useMemo(() => {
    const isChoice =
      reveal.slide.type === 'single_choice' ||
      (reveal.slide.type === 'blind_test' && reveal.slide.answerMode === 'single_choice')

    if (!isChoice) return sortedAnswers

    return sortedAnswers.map((a) => {
      const label = answerIdToLabel.get(String(a.answer))
      return label ? { ...a, answer: label } : a
    })
  }, [answerIdToLabel, reveal.slide.answerMode, reveal.slide.type, sortedAnswers])

  const validatedCount = reveal.validationState.validatedAnswers
  const totalCount = reveal.validationState.totalAnswers

  return (
    <section className="reveal-panel">
      <div className="reveal-panel-header">
        <span>Phase de reveal</span>
        <strong>
          Slide {reveal.revealSlideIndex + 1} / {reveal.totalSlides}
        </strong>
      </div>

      <RevealedSlide slide={reveal.slide} />
      <CorrectAnswerDisplay correctAnswer={reveal.correctAnswer} />
      <div className="reveal-validation-toolbar">
        <div className="reveal-validation-status">
          <span>
            Validées {validatedCount} / {totalCount}
          </span>
        </div>
      </div>

      <PlayerAnswersList
        answers={answersForDisplay}
        currentPlayerId={currentPlayerId}
        pointsForSlide={reveal.slide.points ?? null}
        showActions={isHost}
        onMarkCorrect={(answerId) => onOverrideAnswer?.(answerId, true)}
        onMarkIncorrect={(answerId) => onOverrideAnswer?.(answerId, false)}
      />
    </section>
  )
}
