import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { QRCodeDisplay } from '../components/room/QRCodeDisplay'
import { RevealPanel } from '../components/room/RevealPanel'
import { Scoreboard } from '../components/room/Scoreboard'
import { SlideCanvas } from '../components/slide/SlideCanvas'
import { PageCard } from '../components/ui/PageCard'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { getBackendOrigin } from '../services/audioApi'
import { roomApi } from '../services/roomApi'
import { socketClient } from '../services/socketClient'
import { useAuthStore } from '../stores/authStore'
import type {
  AnswerCountPayload,
  ScoreUpdatedPayload,
  RevealPayload,
  RoomSummary,
  SlideStartedPayload,
} from '../types/room'
import type { RoomResults } from '../types/participation'

export function HostRoomPage() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const accessToken = useAuthStore((state) => state.accessToken)
  const [room, setRoom] = useState<RoomSummary | null>(null)
  const [currentSlide, setCurrentSlide] = useState<SlideStartedPayload['slide'] | null>(
    null,
  )
  const [answerCount, setAnswerCount] = useState<AnswerCountPayload | null>(null)
  const [answeredPlayerIds, setAnsweredPlayerIds] = useState<Set<string>>(new Set())
  const [reveal, setReveal] = useState<RevealPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hiddenElementIds, setHiddenElementIds] = useState<string[]>([])
  const hostAudioRef = useRef<HTMLAudioElement | null>(null)
  const suppressSeekRef = useRef(false)

  const inviteLink = useMemo(() => {
    if (room?.joinUrl) return room.joinUrl
    if (!roomCode) return ''
    return `${window.location.origin}/join/${roomCode}`
  }, [room?.joinUrl, roomCode])

  useEffect(() => {
    if (!roomCode || !accessToken) {
      return
    }

    let isMounted = true

    roomApi
      .getHostRoomByCode(roomCode)
      .then((loadedRoom) => {
        if (isMounted) {
          setRoom(loadedRoom)
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Impossible de charger cette room.")
        }
      })

    socketClient.auth = { token: accessToken }
    if (!socketClient.connected) {
      socketClient.connect()
    }

    const joinHostRoom = () => {
      socketClient.emit('host:join_room', { roomCode }, (state: RoomSummary) => {
        if (state?.code) {
          setRoom(state)
        }
      })
    }

    const handleStateUpdated = (state: RoomSummary) => setRoom(state)
    const handleSlideStarted = (payload: SlideStartedPayload) => {
      setCurrentSlide(payload.slide)
      setReveal(null)
      setAnsweredPlayerIds(new Set())
      setHiddenElementIds([])
    }
    const handleAnswerCountUpdated = (payload: AnswerCountPayload) =>
      (setAnswerCount(payload), setAnsweredPlayerIds(new Set(payload.answeredPlayerIds ?? [])))
    const handleAnswersLocked = (payload: AnswerCountPayload) =>
      (setAnswerCount(payload), setAnsweredPlayerIds(new Set(payload.answeredPlayerIds ?? [])))
    const handleRevealStarted = (state: RoomSummary) => {
      setRoom(state)
      setCurrentSlide(null)
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

    socketClient.on('connect', joinHostRoom)
    socketClient.on('room:state_updated', handleStateUpdated)
    socketClient.on('room:player_joined', () => undefined)
    socketClient.on('room:player_left', () => undefined)
    socketClient.on('quiz:slide_started', handleSlideStarted)
    socketClient.on('quiz:answers_count_updated', handleAnswerCountUpdated)
    socketClient.on('quiz:answers_locked', handleAnswersLocked)
    socketClient.on('quiz:reveal_started', handleRevealStarted)
    socketClient.on('quiz:slide_revealed', handleSlideRevealed)
    socketClient.on('quiz:reveal_finished', handleRevealFinished)
    socketClient.on('quiz:score_updated', handleScoreUpdated)
    socketClient.on('quiz:finished', handleQuizFinished)
    socketClient.on('error', handleError)

    if (socketClient.connected) {
      joinHostRoom()
    }

    return () => {
      isMounted = false
      socketClient.off('connect', joinHostRoom)
      socketClient.off('room:state_updated', handleStateUpdated)
      socketClient.off('room:player_joined')
      socketClient.off('room:player_left')
      socketClient.off('quiz:slide_started', handleSlideStarted)
      socketClient.off('quiz:answers_count_updated', handleAnswerCountUpdated)
      socketClient.off('quiz:answers_locked', handleAnswersLocked)
      socketClient.off('quiz:reveal_started', handleRevealStarted)
      socketClient.off('quiz:slide_revealed', handleSlideRevealed)
      socketClient.off('quiz:reveal_finished', handleRevealFinished)
      socketClient.off('quiz:score_updated', handleScoreUpdated)
      socketClient.off('quiz:finished', handleQuizFinished)
      socketClient.off('error', handleError)
    }
  }, [accessToken, navigate, roomCode])

  const status = room?.status ?? 'WAITING_ROOM'
  const totalSlides = room?.totalSlides ?? 0
  const currentIndex = room?.currentSlideIndex ?? 0
  const revealIndex = room?.revealSlideIndex ?? 0
  const isLastSlide = totalSlides > 0 && currentIndex === totalSlides - 1
  const isLastRevealSlide = totalSlides > 0 && revealIndex === totalSlides - 1
  const canStartQuiz = status === 'WAITING_ROOM'
  const isQuestionPhase = status === 'QUESTION_ACTIVE' || status === 'QUESTION_LOCKED'
  const canNavigateSlides = isQuestionPhase
  const isRevealPhase = status === 'REVEAL_PHASE'
  const canGoNextReveal = Boolean(
    isRevealPhase &&
      reveal &&
      (reveal.validationState.validatedAnswers ?? 0) >= (reveal.validationState.totalAnswers ?? 0),
  )

  const pageTitle = isRevealPhase
    ? reveal?.slide.title ?? `Révélation — slide ${revealIndex + 1} / ${totalSlides}`
    : isQuestionPhase
      ? currentSlide?.title ?? `Quiz — slide ${currentIndex + 1} / ${totalSlides}`
      : 'Session (Host)'

  const pageDescription = isQuestionPhase || isRevealPhase
    ? undefined
    : 'Tout ce qu’il faut pour animer la partie, en grand et au calme.'

  function handleStartQuiz() {
    socketClient.emit('host:start_quiz', { roomCode })
  }

  function handleNextSlide() {
    socketClient.emit('host:next_slide', { roomCode })
  }

  function handlePrevSlide() {
    socketClient.emit('host:prev_slide', { roomCode })
  }

  function handleStartReveal() {
    socketClient.emit('host:start_reveal', { roomCode })
  }

  function handleNextRevealSlide() {
    socketClient.emit('host:next_reveal_slide', { roomCode })
  }

  function handlePrevRevealSlide() {
    socketClient.emit('host:prev_reveal_slide', { roomCode })
  }

  function handleOverrideAnswerValidation(
    answerId: string,
    isCorrect: boolean,
    pointsAwarded?: number,
  ) {
    socketClient.emit('host:override_answer_validation', {
      roomCode,
      answerId,
      isCorrect,
      pointsAwarded,
    })
  }

  function handleFinishQuiz() {
    socketClient.emit('host:finish_quiz', { roomCode })
  }

  function handleResetSession() {
    socketClient.emit('host:reset_session', { roomCode })
    setReveal(null)
    setCurrentSlide(null)
    setAnswerCount(null)
    setHiddenElementIds([])
  }

  function emitAudio(action: 'play' | 'pause' | 'seek') {
    const audio = hostAudioRef.current
    if (!audio || !roomCode) return
    socketClient.emit(`host:audio_${action}`, {
      roomCode,
      position: audio.currentTime ?? 0,
    })
  }

  function hideCanvasElement(elementId: string) {
    if (!roomCode) return
    setHiddenElementIds((current) => (current.includes(elementId) ? current : [...current, elementId]))
    socketClient.emit('host:canvas_element_hide', {
      roomCode,
      elementId,
    })
  }

  return (
    <PageCard
      className="page-card-host"
      title={pageTitle}
      description={pageDescription}
      eyebrow={isQuestionPhase || isRevealPhase ? null : 'Hôte'}
      actions={
        status === 'FINISHED' || canStartQuiz ? (
          <div className="toolbar-actions">
            {status === 'FINISHED' ? (
              <Button onClick={handleResetSession} type="button" variant="secondary" size="lg">
                Relancer une session
              </Button>
            ) : null}
            {canStartQuiz ? (
              <Button
                onClick={handleStartQuiz}
                type="button"
                variant="primary"
                size="lg"
              >
                Démarrer le quiz
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      {error ? <p className="form-error">{error}</p> : null}

      {isRevealPhase ? (
        reveal ? (
          <div className="host-presentation-stack">
            <Scoreboard players={room?.players ?? []} title="Scores" />
            <RevealPanel
              isHost
              onOverrideAnswer={handleOverrideAnswerValidation}
              reveal={reveal}
            />
            <div className="host-presentation-controls">
              <Button
                onClick={handlePrevRevealSlide}
                type="button"
                variant="secondary"
                disabled={revealIndex <= 0}
              >
                Précédent
              </Button>
              {isLastRevealSlide ? (
                <Button
                  onClick={handleFinishQuiz}
                  type="button"
                  variant="primary"
                  disabled={!canGoNextReveal}
                >
                  Terminer
                </Button>
              ) : (
                <Button
                  onClick={handleNextRevealSlide}
                  type="button"
                  variant="primary"
                  disabled={!canGoNextReveal}
                >
                  Suivant
                </Button>
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="En attente" description="En attente de la première slide révélée…" />
        )
      ) : isQuestionPhase ? (
        <div className="host-presentation-stack">
          <div
            className="slide-canvas-stage player-live-stage"
            style={{ background: currentSlide?.backgroundColor ?? undefined }}
          >
            <SlideCanvas
              elements={currentSlide?.elements ?? null}
              hiddenElementIds={hiddenElementIds}
              legacyImageUrl={currentSlide?.imageUrl ?? null}
              legacyQuestion={currentSlide?.question ?? null}
              onHostHideElement={hideCanvasElement}
              showVideoControls
            />

            {status === 'QUESTION_ACTIVE' ? (
              <div className="host-canvas-overlay-bottom-left">
                <strong>Réponses</strong>
                <div className="host-answers-meter">
                  <span>
                    Répondu {answerCount?.answersReceived ?? 0} /{' '}
                    {answerCount?.playersCount ??
                      (room?.players ?? []).filter((p) => p.connected).length ??
                      0}
                  </span>
                </div>
                <div className="host-answers-lists">
                  <div className="host-answers-group">
                    <span className="host-answers-label">A répondu :</span>
                    <div className="host-answers-names">
                      {(room?.players ?? [])
                        .filter((p) => p.connected && answeredPlayerIds.has(p.playerId))
                        .map((p) => (
                          <span className="host-answers-chip" key={`ans_${p.playerId}`}>
                            {p.nickname}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="host-answers-group">
                    <span className="host-answers-label">En attente :</span>
                    <div className="host-answers-names">
                      {(room?.players ?? [])
                        .filter((p) => p.connected && !answeredPlayerIds.has(p.playerId))
                        .map((p) => (
                          <span className="host-answers-chip" key={`wait_${p.playerId}`}>
                            {p.nickname}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {currentSlide?.audio?.storedFileUrl ? (
              <div className="host-canvas-overlay-bottom-right">
                <strong>Audio</strong>
                <audio
                  ref={hostAudioRef}
                  controls
                  preload="none"
                  src={`${getBackendOrigin()}${currentSlide.audio.storedFileUrl}`}
                  onPlay={() => emitAudio('play')}
                  onPause={() => emitAudio('pause')}
                  onSeeked={() => {
                    if (suppressSeekRef.current) {
                      suppressSeekRef.current = false
                      return
                    }
                    emitAudio('seek')
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="host-presentation-controls">
            <Button
              onClick={handlePrevSlide}
              type="button"
              variant="secondary"
              disabled={!canNavigateSlides || currentIndex <= 0}
            >
              Précédent
            </Button>
            {isLastSlide ? (
              <Button
                onClick={handleStartReveal}
                type="button"
                variant="primary"
                disabled={!canNavigateSlides}
              >
                Terminer
              </Button>
            ) : (
              <Button
                onClick={handleNextSlide}
                type="button"
                variant="primary"
                disabled={!canNavigateSlides}
              >
                Suivant
              </Button>
            )}
          </div>
        </div>
      ) : (
        <section className="host-room-layout">
          <aside className="room-side-panel">
            {roomCode && inviteLink ? (
              <QRCodeDisplay joinUrl={inviteLink} roomCode={roomCode} />
            ) : null}
          </aside>

          <section className="room-main-panel">
            <div className="room-status-row">
              <span>{room?.status ?? 'WAITING_ROOM'}</span>
              <span>
                Slide {(room?.currentSlideIndex ?? 0) + 1} / {room?.totalSlides ?? 0}
              </span>
              <span>
                Réponses {answerCount?.answersReceived ?? room?.answersCount ?? 0} /{' '}
                {answerCount?.playersCount ??
                  (room?.players ?? []).filter((player) => player.connected).length ??
                  0}
              </span>
            </div>

            {room?.status === 'FINISHED' ? (
              <EmptyState
                title="Partie terminée"
                description="Les résultats sont prêts. Tu peux fermer cette page."
              />
            ) : (
              <EmptyState
                title="Prêt à lancer"
                description={
                  canStartQuiz
                    ? 'Démarre le quiz pour ouvrir la présentation.'
                    : 'La présentation apparaîtra ici.'
                }
              />
            )}

            <div className="player-list-panel">
              <h3>Joueurs</h3>
              {(room?.players ?? []).length ? (
                <div className="player-list">
                  {(room?.players ?? []).map((player) => (
                    <div className="player-row" key={player.playerId}>
                      <span>{player.nickname}</span>
                      <small>
                        {player.connected ? 'connecté' : 'parti'} — {player.score ?? 0} pts
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Aucun joueur pour le moment.</p>
              )}
            </div>
          </section>
        </section>
      )}
    </PageCard>
  )
}
