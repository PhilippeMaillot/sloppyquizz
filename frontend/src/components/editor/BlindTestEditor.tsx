import {
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { audioApi, getBackendOrigin, type YoutubeAudioPreview } from '../../services/audioApi'
import type { BlindTestAnswerMode, BlindTestSlide, ChoiceAnswer } from '../../types/quiz'

type BlindTestEditorProps = {
  quizId: string
  slide: BlindTestSlide
  onChange: (slide: BlindTestSlide) => void
}

type DragTarget = 'start' | 'end'

const DEFAULT_END_TIME = 20
const MAX_EXTRACT_SECONDS = 60

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function createDefaultAnswers(): ChoiceAnswer[] {
  return [
    { id: createId('answer'), text: 'Réponse A', isCorrect: false },
    { id: createId('answer'), text: 'Réponse B', isCorrect: false },
  ]
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(Math.max(value, min), max)
}

function toWholeSecond(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.round(value))
}

function formatTime(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '--:--'
  }

  const totalSeconds = Math.max(0, Math.floor(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function BlindTestEditor({ quizId, slide, onChange }: BlindTestEditorProps) {
  const [sourceUrl, setSourceUrl] = useState(slide.audio?.sourceUrl ?? '')
  const [startTime, setStartTime] = useState(slide.audio?.startTime ?? 0)
  const [endTime, setEndTime] = useState(slide.audio?.endTime ?? DEFAULT_END_TIME)
  const [sourcePreview, setSourcePreview] = useState<YoutubeAudioPreview | null>(null)
  const [sourceDuration, setSourceDuration] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sourceAudioRef = useRef<HTMLAudioElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const playSelectionRef = useRef(false)

  useEffect(() => {
    setSourceUrl(slide.audio?.sourceUrl ?? '')
    setStartTime(slide.audio?.startTime ?? 0)
    setEndTime(slide.audio?.endTime ?? DEFAULT_END_TIME)
    setSourcePreview(null)
    setSourceDuration(null)
    setCurrentTime(0)
    setDragTarget(null)
    playSelectionRef.current = false
  }, [slide.id])

  const excerptPreviewUrl = useMemo(() => {
    if (!slide.audio?.storedFileUrl) {
      return null
    }
    return `${getBackendOrigin()}${slide.audio.storedFileUrl}`
  }, [slide.audio?.storedFileUrl])

  const timelineDuration = Math.max(
    sourceDuration ?? sourcePreview?.duration ?? endTime ?? DEFAULT_END_TIME,
    1,
  )
  const selectionStartPercent = clamp((startTime / timelineDuration) * 100, 0, 100)
  const selectionEndPercent = clamp((endTime / timelineDuration) * 100, 0, 100)
  const progressPercent = clamp((currentTime / timelineDuration) * 100, 0, 100)
  const selectedDuration = Math.max(0, endTime - startTime)
  const cleanSourceUrl = sourceUrl.trim()

  function normalizeEnd(nextEnd: number, nextStart: number, maxTime: number | null) {
    let normalizedEnd = toWholeSecond(nextEnd)
    normalizedEnd = Math.max(normalizedEnd, nextStart + 1)
    normalizedEnd = Math.min(normalizedEnd, nextStart + MAX_EXTRACT_SECONDS)

    if (maxTime !== null) {
      normalizedEnd = Math.min(normalizedEnd, maxTime)
      if (normalizedEnd <= nextStart) {
        normalizedEnd = Math.min(nextStart + 1, maxTime)
      }
    }

    return normalizedEnd
  }

  function seekTo(time: number) {
    const boundedTime = clamp(time, 0, timelineDuration)
    if (sourceAudioRef.current) {
      sourceAudioRef.current.currentTime = boundedTime
    }
    setCurrentTime(boundedTime)
  }

  function updateStartTime(nextStartTime: number, shouldSeek = true) {
    const maxStart = sourceDuration !== null ? Math.max(0, sourceDuration - 1) : Number.MAX_SAFE_INTEGER
    const nextStart = clamp(toWholeSecond(nextStartTime), 0, maxStart)
    const nextEnd = normalizeEnd(endTime, nextStart, sourceDuration)

    setStartTime(nextStart)
    setEndTime(nextEnd)
    if (shouldSeek) {
      seekTo(nextStart)
    }
  }

  function updateEndTime(nextEndTime: number, shouldSeek = true) {
    const nextEnd = normalizeEnd(nextEndTime, startTime, sourceDuration)

    setEndTime(nextEnd)
    if (shouldSeek) {
      seekTo(nextEnd)
    }
  }

  function getTimelineTime(event: ReactPointerEvent<HTMLElement>) {
    const timeline = timelineRef.current
    if (!timeline) {
      return 0
    }

    const rect = timeline.getBoundingClientRect()
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    return ratio * timelineDuration
  }

  function startTimelineDrag(target: DragTarget, event: ReactPointerEvent<HTMLElement>) {
    setDragTarget(target)
    timelineRef.current?.setPointerCapture(event.pointerId)

    const pointerTime = getTimelineTime(event)
    if (target === 'start') {
      updateStartTime(pointerTime)
    } else {
      updateEndTime(pointerTime)
    }
  }

  function handleTimelinePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const pointerTime = getTimelineTime(event)
    const nearestTarget =
      Math.abs(pointerTime - startTime) <= Math.abs(pointerTime - endTime) ? 'start' : 'end'
    startTimelineDrag(nearestTarget, event)
  }

  function handleTimelinePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragTarget) {
      return
    }

    const pointerTime = getTimelineTime(event)
    if (dragTarget === 'start') {
      updateStartTime(pointerTime)
    } else {
      updateEndTime(pointerTime)
    }
  }

  function stopTimelineDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (timelineRef.current?.hasPointerCapture(event.pointerId)) {
      timelineRef.current.releasePointerCapture(event.pointerId)
    }
    setDragTarget(null)
  }

  function handleHandlePointerDown(
    target: DragTarget,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.stopPropagation()
    startTimelineDrag(target, event)
  }

  function handleSourceUrlChange(value: string) {
    setSourceUrl(value)

    if (sourcePreview && value.trim() !== sourcePreview.sourceUrl) {
      setSourcePreview(null)
      setSourceDuration(null)
      setCurrentTime(0)
      playSelectionRef.current = false
    }
  }

  async function handleLoadPreview() {
    if (!cleanSourceUrl) {
      setError('Ajoute une URL YouTube avant de charger la musique.')
      return
    }

    setIsLoadingPreview(true)
    setError(null)

    try {
      const preview = await audioApi.prepareYoutubePreview({
        quizId,
        slideId: slide.id,
        sourceUrl: cleanSourceUrl,
      })
      const maxTime = preview.duration
      const nextStart = clamp(
        toWholeSecond(startTime),
        0,
        maxTime !== null ? Math.max(0, maxTime - 1) : Number.MAX_SAFE_INTEGER,
      )
      const nextEnd = normalizeEnd(endTime, nextStart, maxTime)

      setSourcePreview(preview)
      setSourceDuration(maxTime)
      setStartTime(nextStart)
      setEndTime(nextEnd)
      setCurrentTime(0)
      playSelectionRef.current = false
    } catch {
      setError("Impossible de charger la musique. Vérifie le lien YouTube et l'installation de yt-dlp.")
    } finally {
      setIsLoadingPreview(false)
    }
  }

  async function handleProcess() {
    const nextStart = toWholeSecond(startTime)
    const nextEnd = toWholeSecond(endTime)

    if (!cleanSourceUrl) {
      setError('Ajoute une URL YouTube avant de générer l’extrait.')
      return
    }

    if (nextEnd <= nextStart) {
      setError('La fin doit être après le début.')
      return
    }

    if (nextEnd - nextStart > MAX_EXTRACT_SECONDS) {
      setError(`Le passage ne peut pas dépasser ${MAX_EXTRACT_SECONDS} secondes.`)
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const audio = await audioApi.processYoutube({
        quizId,
        slideId: slide.id,
        sourceUrl: cleanSourceUrl,
        startTime: nextStart,
        endTime: nextEnd,
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

  function handleSourceLoadedMetadata(event: SyntheticEvent<HTMLAudioElement>) {
    const duration = event.currentTarget.duration
    if (!Number.isFinite(duration)) {
      return
    }

    const roundedDuration = Math.floor(duration)
    setSourceDuration(roundedDuration)

    if (endTime > roundedDuration) {
      const nextStart = clamp(startTime, 0, Math.max(0, roundedDuration - 1))
      setStartTime(nextStart)
      setEndTime(normalizeEnd(endTime, nextStart, roundedDuration))
    }
  }

  function handleSourceTimeUpdate(event: SyntheticEvent<HTMLAudioElement>) {
    const nextCurrentTime = event.currentTarget.currentTime
    setCurrentTime(nextCurrentTime)

    if (playSelectionRef.current && nextCurrentTime >= endTime) {
      event.currentTarget.pause()
      event.currentTarget.currentTime = endTime
      playSelectionRef.current = false
      setCurrentTime(endTime)
    }
  }

  async function playSelectedRange() {
    if (!sourceAudioRef.current || !sourcePreview) {
      return
    }

    playSelectionRef.current = true
    sourceAudioRef.current.currentTime = startTime
    setCurrentTime(startTime)

    try {
      await sourceAudioRef.current.play()
    } catch {
      playSelectionRef.current = false
    }
  }

  function setSelectionFromCurrent(target: DragTarget) {
    if (target === 'start') {
      updateStartTime(currentTime, false)
    } else {
      updateEndTime(currentTime, false)
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

      <section className="score-update-card blind-audio-card">
        <h3>Musique</h3>

        <label className="form-field">
          URL YouTube
          <input
            onChange={(event) => handleSourceUrlChange(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            type="url"
            value={sourceUrl}
          />
        </label>

        <div className="toolbar-actions">
          <button
            className="secondary-button"
            disabled={isLoadingPreview || !cleanSourceUrl}
            onClick={handleLoadPreview}
            type="button"
          >
            {isLoadingPreview ? 'Chargement...' : 'Charger la musique'}
          </button>
        </div>

        {sourcePreview ? (
          <div className="blind-source-preview">
            <div className="blind-source-meta">
              <strong>{sourcePreview.title ?? 'Source audio'}</strong>
              <span>{formatTime(sourceDuration ?? sourcePreview.duration)}</span>
            </div>

            <audio
              controls
              onLoadedMetadata={handleSourceLoadedMetadata}
              onPause={() => {
                playSelectionRef.current = false
              }}
              onTimeUpdate={handleSourceTimeUpdate}
              preload="metadata"
              ref={sourceAudioRef}
              src={sourcePreview.previewUrl}
            />

            <div className="blind-range-summary">
              <strong>
                {formatTime(startTime)} - {formatTime(endTime)}
              </strong>
              <span>{selectedDuration}s</span>
            </div>

            <div
              aria-label="Sélection du passage audio"
              className="blind-timeline"
              onPointerCancel={stopTimelineDrag}
              onPointerDown={handleTimelinePointerDown}
              onPointerLeave={(event) => {
                if (dragTarget) {
                  stopTimelineDrag(event)
                }
              }}
              onPointerMove={handleTimelinePointerMove}
              onPointerUp={stopTimelineDrag}
              ref={timelineRef}
              role="group"
            >
              <div className="blind-timeline-track" />
              <div
                className="blind-timeline-selection"
                style={{
                  left: `${selectionStartPercent}%`,
                  width: `${Math.max(0, selectionEndPercent - selectionStartPercent)}%`,
                }}
              />
              <div className="blind-timeline-progress" style={{ left: `${progressPercent}%` }} />
              <button
                aria-label="Début du passage"
                className="blind-timeline-handle blind-timeline-handle-start"
                onPointerDown={(event) => handleHandlePointerDown('start', event)}
                style={{ left: `${selectionStartPercent}%` }}
                type="button"
              />
              <button
                aria-label="Fin du passage"
                className="blind-timeline-handle blind-timeline-handle-end"
                onPointerDown={(event) => handleHandlePointerDown('end', event)}
                style={{ left: `${selectionEndPercent}%` }}
                type="button"
              />
            </div>

            <div className="toolbar-actions blind-preview-actions">
              <button className="secondary-button" onClick={playSelectedRange} type="button">
                Lire le passage
              </button>
              <button
                className="secondary-button"
                onClick={() => setSelectionFromCurrent('start')}
                type="button"
              >
                Début ici
              </button>
              <button
                className="secondary-button"
                onClick={() => setSelectionFromCurrent('end')}
                type="button"
              >
                Fin ici
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="slide-settings-row">
        <input name="audioStartTime" readOnly type="hidden" value={startTime} />
        <input name="audioEndTime" readOnly type="hidden" value={endTime} />
        <button className="primary-button" disabled={isProcessing} onClick={handleProcess} type="button">
          {isProcessing ? 'Génération...' : "Générer l'extrait"}
        </button>
      </div>

      {excerptPreviewUrl ? (
        <section className="score-update-card">
          <h3>Extrait généré</h3>
          <audio controls preload="none" src={excerptPreviewUrl} />
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
        <p className="form-hint">
          La validation sera faite manuellement par le host pendant le reveal.
        </p>
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
