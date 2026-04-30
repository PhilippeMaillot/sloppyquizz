import { useMemo, useState } from 'react'

import { audioApi, getBackendOrigin } from '../../services/audioApi'
import type { BlindTestAnswerMode, BlindTestSlide, ChoiceAnswer } from '../../types/quiz'

type BlindTestEditorProps = {
  quizId: string
  slide: BlindTestSlide
  onChange: (slide: BlindTestSlide) => void
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function createDefaultAnswers(): ChoiceAnswer[] {
  return [
    { id: createId('answer'), text: 'Réponse A', isCorrect: true },
    { id: createId('answer'), text: 'Réponse B', isCorrect: false },
  ]
}

export function BlindTestEditor({ quizId, slide, onChange }: BlindTestEditorProps) {
  const [sourceUrl, setSourceUrl] = useState(slide.audio?.sourceUrl ?? '')
  const [startTime, setStartTime] = useState(slide.audio?.startTime ?? 0)
  const [endTime, setEndTime] = useState(slide.audio?.endTime ?? 20)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewUrl = useMemo(() => {
    if (!slide.audio?.storedFileUrl) {
      return null
    }
    return `${getBackendOrigin()}${slide.audio.storedFileUrl}`
  }, [slide.audio?.storedFileUrl])

  async function handleProcess() {
    setIsProcessing(true)
    setError(null)

    try {
      const audio = await audioApi.processYoutube({
        quizId,
        slideId: slide.id,
        sourceUrl: sourceUrl.trim(),
        startTime: Number(startTime),
        endTime: Number(endTime),
      })
      onChange({
        ...slide,
        audio,
      })
    } catch {
      setError("Impossible de générer l'extrait audio. Vérifie le lien, les timestamps et l'installation de ffmpeg/yt-dlp.")
    } finally {
      setIsProcessing(false)
    }
  }

  function setAnswerMode(mode: BlindTestAnswerMode) {
    if (mode === 'text') {
      onChange({ ...slide, answerMode: mode })
      return
    }
    const hasAnswers = slide.answers?.length >= 2
    onChange({
      ...slide,
      answerMode: mode,
      answers: hasAnswers ? slide.answers : createDefaultAnswers(),
    })
  }

  function addAnswer() {
    onChange({
      ...slide,
      answers: [
        ...slide.answers,
        { id: createId('answer'), text: `Answer ${slide.answers.length + 1}`, isCorrect: false },
      ],
    })
  }

  function updateAnswer(answerId: string, patch: Partial<ChoiceAnswer>) {
    const nextAnswers = slide.answers.map((answer) => {
      if (answer.id !== answerId) {
        return answer
      }
      return { ...answer, ...patch }
    })

    if (slide.answerMode === 'single_choice' && patch.isCorrect) {
      onChange({
        ...slide,
        answers: nextAnswers.map((answer) => ({ ...answer, isCorrect: answer.id === answerId })),
      })
      return
    }

    onChange({ ...slide, answers: nextAnswers })
  }

  function deleteAnswer(answerId: string) {
    onChange({ ...slide, answers: slide.answers.filter((a) => a.id !== answerId) })
  }

  return (
    <section className="slide-editor">
      {error ? <p className="form-error">{error}</p> : null}

      <label className="form-field">
        URL YouTube
        <input
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          type="url"
          value={sourceUrl}
        />
      </label>

      <div className="slide-settings-row">
        <label className="form-field">
          Début (s)
          <input
            min={0}
            onChange={(event) => setStartTime(Number(event.target.value))}
            type="number"
            value={startTime}
          />
        </label>
        <label className="form-field">
          Fin (s)
          <input
            min={0}
            onChange={(event) => setEndTime(Number(event.target.value))}
            type="number"
            value={endTime}
          />
        </label>
        <button className="primary-button" disabled={isProcessing} onClick={handleProcess} type="button">
          {isProcessing ? 'Génération...' : "Générer l'extrait"}
        </button>
      </div>

      {previewUrl ? (
        <section className="score-update-card">
          <h3>Prévisualisation</h3>
          <audio controls preload="none" src={previewUrl} />
          <small>{slide.audio?.duration ?? 0}s</small>
        </section>
      ) : null}

      <section className="score-update-card">
        <h3>Mode de réponse</h3>
        <div className="toolbar-actions">
          <button
            className={slide.answerMode === 'text' ? 'primary-button' : 'secondary-button'}
            onClick={() => setAnswerMode('text')}
            type="button"
          >
            Texte
          </button>
          <button
            className={slide.answerMode === 'single_choice' ? 'primary-button' : 'secondary-button'}
            onClick={() => setAnswerMode('single_choice')}
            type="button"
          >
            Choix unique
          </button>
        </div>
      </section>

      {slide.answerMode === 'text' ? (
        <>
          <label className="form-field">
            Réponse attendue
            <input
              onChange={(event) => onChange({ ...slide, expectedAnswer: event.target.value })}
              type="text"
              value={slide.expectedAnswer}
            />
          </label>
          <p className="form-hint">
            La validation sera faite manuellement par le host pendant le reveal.
          </p>
        </>
      ) : (
        <section className="score-update-card">
          <h3>Réponses (QCM)</h3>
          {slide.answers.map((answer) => (
            <div className="answer-row" key={answer.id}>
              <input
                onChange={(event) => updateAnswer(answer.id, { text: event.target.value })}
                type="text"
                value={answer.text}
              />
              <label className="answer-correct-toggle">
                <input
                  checked={answer.isCorrect}
                  onChange={(event) => updateAnswer(answer.id, { isCorrect: event.target.checked })}
                  type={slide.answerMode === 'single_choice' ? 'radio' : 'checkbox'}
                />
                Correcte
              </label>
              <button className="danger-button" onClick={() => deleteAnswer(answer.id)} type="button">
                Supprimer
              </button>
            </div>
          ))}
          <div className="toolbar-actions">
            <button className="secondary-button" onClick={addAnswer} type="button">
              Ajouter une réponse
            </button>
          </div>
        </section>
      )}
    </section>
  )
}
