import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { RevealPanel } from '../components/room/RevealPanel'
import { ScoreUpdateDisplay } from '../components/room/ScoreUpdateDisplay'
import { Scoreboard } from '../components/room/Scoreboard'
import { SlideCanvas } from '../components/slide/SlideCanvas'
import { PageCard } from '../components/ui/PageCard'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { FormField, Input } from '../components/ui/FormField'
import { getBackendOrigin } from '../services/audioApi'
import { socketClient } from '../services/socketClient'
import { useAuthStore } from '../stores/authStore'
import type {
  AnswerReceivedPayload,
  AudioControlPayload,
  ScoreUpdatedPayload,
  RevealPayload,
  RoomSummary,
  SlideStartedPayload,
} from '../types/room'
import { PLAYER_SESSION_KEY } from './JoinRoomPage'
import type { RoomResults } from '../types/participation'

type PlayerSession = {
  roomCode: string
  playerId: string
  nickname: string
}

export function PlayerRoomPage() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const accessToken = useAuthStore((state) => state.accessToken)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [session, setSession] = useState<PlayerSession | null>(null)
  const [room, setRoom] = useState<RoomSummary | null>(null)
  const [currentSlide, setCurrentSlide] = useState<SlideStartedPayload['slide'] | null>(
    null,
  )
  const [selectedAnswerId, setSelectedAnswerId] = useState('')
  const [textAnswer, setTextAnswer] = useState('')
  const [submittedAnswer, setSubmittedAnswer] =
    useState<AnswerReceivedPayload | null>(null)
  const [reveal, setReveal] = useState<RevealPayload | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const playerAudioRef = useRef<HTMLAudioElement | null>(null)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const pendingAudioRef = useRef<AudioControlPayload | null>(null)

  const playerAudioSrc =
    currentSlide?.audio?.storedFileUrl
      ? currentSlide.audio.storedFileUrl.startsWith('http')
        ? currentSlide.audio.storedFileUrl
        : `${getBackendOrigin()}${currentSlide.audio.storedFileUrl}`
      : null

  useEffect(() => {
    const storedSession = sessionStorage.getItem(PLAYER_SESSION_KEY)
    if (storedSession) {
      const parsedSession = JSON.parse(storedSession) as PlayerSession
      setSession(parsedSession)
    }

    const handleStateUpdated = (state: RoomSummary) => setRoom(state)
    const handleSlideStarted = (payload: SlideStartedPayload) => {
      setCurrentSlide(payload.slide)
      setReveal(null)
      setSelectedAnswerId('')
      setTextAnswer('')
      setSubmittedAnswer(null)
      setIsSubmitting(false)
      setIsLocked(false)
      setError(null)
    }
    const handleAnswerReceived = (payload: AnswerReceivedPayload) => {
      setSubmittedAnswer(payload)
      setIsSubmitting(false)
    }
    const handleAnswersLocked = () => {
      setIsLocked(true)
      setIsSubmitting(false)
    }
    const handleRevealStarted = (state: RoomSummary) => {
      setRoom(state)
      setCurrentSlide(null)
      setIsLocked(true)
      setIsSubmitting(false)
    }
    const handleSlideRevealed = (payload: RevealPayload) => setReveal(payload)
    const handleRevealFinished = (state: RoomSummary) => {
      setRoom(state)
      setReveal(null)
    }
    const handleQuizFinished = (payload: RoomResults) => {
      if (payload?.roomId) {
        navigate(`/results/${payload.roomId}`)
      }
    }
    const handleScoreUpdated = (payload: ScoreUpdatedPayload) => {
      setRoom((current) => {
        if (!current) {
          return current
        }
        if (current.code !== payload.roomCode) {
          return current
        }
        const scoreByPlayer = new Map(payload.players.map((p) => [p.playerId, p.score]))
        return {
          ...current,
          players: current.players.map((player) => ({
            ...player,
            score: scoreByPlayer.get(player.playerId) ?? player.score,
          })),
        }
      })
    }
    const handleError = (payload: { message?: string }) =>
      setError(payload.message ?? 'Live room error.')

    const handleAudioControl = async (payload: AudioControlPayload) => {
      const audio = playerAudioRef.current
      if (!audio) return

      // Ignore if not on the same slide/audio.
      if (payload.slideId && currentSlide?.id && payload.slideId !== currentSlide.id) {
        return
      }

      if (typeof payload.position === 'number' && payload.position >= 0) {
        const drift = Math.max(0, Date.now() / 1000 - (payload.sentAt ?? 0))
        const target = payload.action === 'play' ? payload.position + drift : payload.position
        try {
          audio.currentTime = Math.max(0, target)
        } catch {
          // ignore
        }
      }

      if (payload.action === 'pause') {
        audio.pause()
        return
      }

      if (payload.action === 'seek') {
        return
      }

      // play
      try {
        pendingAudioRef.current = null
        setAudioBlocked(false)
        await audio.play()
      } catch {
        pendingAudioRef.current = payload
        setAudioBlocked(true)
      }
    }

    socketClient.on('room:state_updated', handleStateUpdated)
    socketClient.on('quiz:slide_started', handleSlideStarted)
    socketClient.on('quiz:answer_received', handleAnswerReceived)
    socketClient.on('quiz:answers_locked', handleAnswersLocked)
    socketClient.on('quiz:reveal_started', handleRevealStarted)
    socketClient.on('quiz:slide_revealed', handleSlideRevealed)
    socketClient.on('quiz:reveal_finished', handleRevealFinished)
    socketClient.on('quiz:score_updated', handleScoreUpdated)
    socketClient.on('quiz:finished', handleQuizFinished)
    socketClient.on('quiz:audio_control', handleAudioControl)
    socketClient.on('error', handleError)

    return () => {
      socketClient.off('room:state_updated', handleStateUpdated)
      socketClient.off('quiz:slide_started', handleSlideStarted)
      socketClient.off('quiz:answer_received', handleAnswerReceived)
      socketClient.off('quiz:answers_locked', handleAnswersLocked)
      socketClient.off('quiz:reveal_started', handleRevealStarted)
      socketClient.off('quiz:slide_revealed', handleSlideRevealed)
      socketClient.off('quiz:reveal_finished', handleRevealFinished)
      socketClient.off('quiz:score_updated', handleScoreUpdated)
      socketClient.off('quiz:finished', handleQuizFinished)
      socketClient.off('quiz:audio_control', handleAudioControl)
      socketClient.off('error', handleError)
    }
  }, [currentSlide?.id, navigate])

  useEffect(() => {
    if (!session) return
    if (!roomCode && !session.roomCode) return

    if (!isAuthenticated || !accessToken) {
      setError('Connexion requise.')
      return
    }

    socketClient.auth = { token: accessToken }
    if (!socketClient.connected) {
      socketClient.connect()
    }

    socketClient.emit(
      'player:rejoin_room',
      { roomCode: (roomCode ?? session.roomCode).toUpperCase(), playerId: session.playerId },
      (ack: { ok?: boolean; error?: string; room?: RoomSummary }) => {
        if (ack?.error || ack?.ok === false) {
          setError(ack?.error ?? 'Impossible de se reconnecter à la session.')
          return
        }
        if (ack?.room) {
          setRoom(ack.room)
          if (ack.room.status === 'FINISHED' && ack.room.id) {
            navigate(`/results/${ack.room.id}`)
          }
        }
      },
    )
  }, [accessToken, isAuthenticated, navigate, roomCode, session])

  async function unlockAudio() {
    const audio = playerAudioRef.current
    if (!audio) return
    try {
      setAudioBlocked(false)
      await audio.play()
      audio.pause()
      setAudioUnlocked(true)
      const pending = pendingAudioRef.current
      if (pending?.action === 'play') {
        pendingAudioRef.current = null
        await audio.play()
      }
    } catch {
      setAudioUnlocked(false)
      setAudioBlocked(true)
    }
  }

  function handleLeaveRoom() {
    socketClient.emit('player:leave_room', { roomCode })
    sessionStorage.removeItem(PLAYER_SESSION_KEY)
    setSession(null)
  }

  function buildAnswer() {
    if (currentSlide?.type === 'single_choice') {
      return selectedAnswerId
    }

    if (currentSlide?.type === 'blind_test') {
      if (currentSlide.answerMode === 'single_choice') {
        return selectedAnswerId
      }
      return textAnswer.trim()
    }

    return textAnswer.trim()
  }

  function canSubmit() {
    if (!session || !currentSlide?.id || submittedAnswer || isLocked || isSubmitting) {
      return false
    }

    if (currentSlide.type === 'single_choice') {
      return Boolean(selectedAnswerId)
    }

    if (currentSlide.type === 'blind_test') {
      if (currentSlide.answerMode === 'single_choice') {
        return Boolean(selectedAnswerId)
      }
      return Boolean(textAnswer.trim())
    }

    return Boolean(textAnswer.trim())
  }

  function handleSubmitAnswer() {
    if (!session || !currentSlide?.id || !canSubmit()) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    socketClient.emit(
      'player:submit_answer',
      {
        roomCode: roomCode ?? session.roomCode,
        slideId: currentSlide.id,
        playerId: session.playerId,
        answer: buildAnswer(),
      },
      (ack: { ok?: boolean; error?: string }) => {
        if (ack?.error) {
          setError(ack.error)
          setIsSubmitting(false)
        }
      },
    )
  }

  const pageTitle =
    room?.status === 'REVEAL_PHASE'
      ? 'Révélation'
      : currentSlide?.title ??
        (room?.quizTitle ? `Session — ${room.quizTitle}` : 'Session')

  return (
    <PageCard
      title={pageTitle}
      eyebrow={null}
    >
      {error ? <p className="form-error">{error}</p> : null}

      {room?.status === 'REVEAL_PHASE' ? (
        reveal ? (
          <>
            <EmptyState
              title="Reveal en cours"
              description="Le host révèle les réponses slide par slide."
            />
            {session?.playerId ? (
              <ScoreUpdateDisplay currentPlayerId={session.playerId} reveal={reveal} />
            ) : null}
            {room?.players?.length ? (
              <Scoreboard
                highlightPlayerId={session?.playerId ?? undefined}
                players={room.players}
                title="Scores"
              />
            ) : null}
            <RevealPanel reveal={reveal} currentPlayerId={session?.playerId} />
          </>
        ) : (
          <EmptyState
            title="Reveal en cours"
            description="En attente de la première slide révélée…"
          />
        )
      ) : room?.status === 'QUESTION_ACTIVE' ? (
        <>
          <div
            className="slide-canvas-stage player-live-stage"
            style={{ background: currentSlide?.backgroundColor ?? undefined }}
          >
            <SlideCanvas
              elements={(currentSlide?.elements as any) ?? null}
              legacyImageUrl={currentSlide?.imageUrl ?? null}
              legacyQuestion={currentSlide?.question ?? null}
            />

            <audio
              ref={playerAudioRef}
              preload="none"
              src={playerAudioSrc ?? undefined}
              playsInline
              style={{ display: 'none' }}
            />

            <div className="player-canvas-overlay-bottom">
              {playerAudioSrc && !audioUnlocked ? (
                <div className="player-audio-unlock">
                  <p className={audioBlocked ? 'form-error' : undefined}>
                    Active le son une fois (obligatoire sur certains navigateurs), puis l’audio du host se lancera automatiquement.
                  </p>
                  <Button onClick={unlockAudio} type="button" variant="primary">
                    Activer le son
                  </Button>
                </div>
              ) : audioBlocked ? (
                <p className="form-error">
                  Son bloqué par le navigateur. Clique “Activer le son”.
                </p>
              ) : null}
              {currentSlide?.type === 'single_choice' ? (
                <div className="player-answer-options">
                  {currentSlide.answers?.map((answer) => (
                    <label className="player-answer-option" key={answer.id}>
                      <input
                        checked={selectedAnswerId === answer.id}
                        disabled={Boolean(submittedAnswer) || isLocked}
                        name="single-choice-answer"
                        onChange={() => setSelectedAnswerId(answer.id ?? '')}
                        type="radio"
                      />
                      {answer.text}
                    </label>
                  ))}
                </div>
              ) : null}

              {currentSlide?.type === 'blind_test' && currentSlide.answerMode === 'single_choice' ? (
                <div className="player-answer-options">
                  {currentSlide.answers?.map((answer) => (
                    <label className="player-answer-option" key={answer.id}>
                      <input
                        checked={selectedAnswerId === answer.id}
                        disabled={Boolean(submittedAnswer) || isLocked}
                        name="blind-test-single-choice-answer"
                        onChange={() => setSelectedAnswerId(answer.id ?? '')}
                        type="radio"
                      />
                      {answer.text}
                    </label>
                  ))}
                </div>
              ) : null}

              {currentSlide?.type === 'blind_test' && currentSlide.answerMode === 'text' ? (
                <FormField label="Ta réponse">
                  <Input
                    disabled={Boolean(submittedAnswer) || isLocked}
                    onChange={(event) => setTextAnswer(event.target.value)}
                    type="text"
                    value={textAnswer}
                  />
                </FormField>
              ) : null}

              {currentSlide?.type === 'text_answer' ? (
                <FormField label="Ta réponse">
                  <Input
                    disabled={Boolean(submittedAnswer) || isLocked}
                    onChange={(event) => setTextAnswer(event.target.value)}
                    type="text"
                    value={textAnswer}
                  />
                </FormField>
              ) : null}

              {submittedAnswer ? <p className="form-success">Réponse envoyée.</p> : null}
              {isLocked && !submittedAnswer ? (
                <p className="form-error">Réponses verrouillées.</p>
              ) : null}

              <Button
                disabled={!canSubmit()}
                onClick={handleSubmitAnswer}
                type="button"
                variant="primary"
                size="lg"
              >
                {isSubmitting ? 'Envoi…' : submittedAnswer ? 'Réponse envoyée' : 'Envoyer ma réponse'}
              </Button>
            </div>
          </div>
        </>
      ) : room?.status === 'QUESTION_LOCKED' ? (
        <>
          <div
            className="slide-canvas-stage player-live-stage"
            style={{ background: currentSlide?.backgroundColor ?? undefined }}
          >
            <SlideCanvas
              elements={(currentSlide?.elements as any) ?? null}
              legacyImageUrl={currentSlide?.imageUrl ?? null}
              legacyQuestion={currentSlide?.question ?? null}
            />
            <audio
              ref={playerAudioRef}
              preload="none"
              src={playerAudioSrc ?? undefined}
              playsInline
              style={{ display: 'none' }}
            />

            <div className="player-canvas-overlay-bottom">
              {playerAudioSrc && !audioUnlocked ? (
                <div className="player-audio-unlock">
                  <p className={audioBlocked ? 'form-error' : undefined}>
                    Active le son une fois, puis l’audio du host se lancera automatiquement.
                  </p>
                  <Button onClick={unlockAudio} type="button" variant="primary">
                    Activer le son
                  </Button>
                </div>
              ) : null}
              <p className="form-error">Réponses verrouillées. Le host va bientôt révéler.</p>
            </div>
          </div>
        </>
      ) : room?.status === 'FINISHED' ? (
        <EmptyState title="Terminé" description="La partie est terminée. Merci d’avoir joué !" />
      ) : (
        <EmptyState
          title="En attente du host"
          description="La partie apparaîtra ici dès que le host démarre."
        />
      )}

    </PageCard>
  )
}
