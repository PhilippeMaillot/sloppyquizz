import { useMemo } from 'react'
import type { RevealPayload } from '../../types/room'
import { PlayerAnswersList } from './PlayerAnswersList'
import { RevealedSlide } from './RevealedSlide'

type RevealPanelProps = {
  reveal: RevealPayload
  currentPlayerId?: string
  isHost?: boolean
  onOverrideAnswer?: (answerId: string, isCorrect: boolean, pointsAwarded?: number) => void
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

  return (
    <section className="reveal-panel">
      <RevealedSlide slide={reveal.slide} />

      <PlayerAnswersList
        answers={answersForDisplay}
        currentPlayerId={currentPlayerId}
        pointsForSlide={reveal.slide.points ?? null}
        showActions={isHost}
        onMarkCorrect={(answerId, pointsAwarded) =>
          onOverrideAnswer?.(answerId, true, pointsAwarded)
        }
        onMarkIncorrect={(answerId) => onOverrideAnswer?.(answerId, false)}
      />
    </section>
  )
}
