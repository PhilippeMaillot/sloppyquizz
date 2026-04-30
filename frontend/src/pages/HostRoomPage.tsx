import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { QRCodeDisplay } from '../components/room/QRCodeDisplay'
import { RevealPanel } from '../components/room/RevealPanel'
import { Scoreboard } from '../components/room/Scoreboard'
import { SlideCanvas } from '../components/slide/SlideCanvas'
import { PageCard } from '../components/ui/PageCard'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
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
  const [presentationOpen, setPresentationOpen] = useState(false)
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
  const canStartQuiz = status === 'WAITING_ROOM'
  const canNavigateSlides = status === 'QUESTION_ACTIVE'
  const canLockAnswers = status === 'QUESTION_ACTIVE'
  const canStartReveal = status === 'QUESTION_LOCKED' && isLastSlide
  const isRevealPhase = status === 'REVEAL_PHASE'
  const canGoNextReveal = Boolean(
    isRevealPhase &&
      reveal &&
      (reveal.validationState.validatedAnswers ?? 0) >= (reveal.validationState.totalAnswers ?? 0),
  )

  useEffect(() => {
    if (status === 'QUESTION_ACTIVE' || status === 'QUESTION_LOCKED' || status === 'REVEAL_PHASE') {
      setPresentationOpen(true)
    }
    if (status === 'WAITING_ROOM' || status === 'FINISHED') {
      setPresentationOpen(false)
    }
  }, [status])

  function handleStartQuiz() {
    socketClient.emit('host:start_quiz', { roomCode })
  }

  function handleNextSlide() {
    socketClient.emit('host:next_slide', { roomCode })
  }

  function handlePrevSlide() {
    socketClient.emit('host:prev_slide', { roomCode })
  }

  function handleLockAnswers() {
    socketClient.emit('host:lock_answers', { roomCode })
  }

  function handleStartReveal() {
    socketClient.emit('host:start_reveal', { roomCode })
  }

  function handleRevealCurrentSlide() {
    socketClient.emit('host:reveal_slide', { roomCode })
  }

  function handleNextRevealSlide() {
    socketClient.emit('host:next_reveal_slide', { roomCode })
  }

  function handlePrevRevealSlide() {
    socketClient.emit('host:prev_reveal_slide', { roomCode })
  }

  function handleOverrideAnswerValidation(answerId: string, isCorrect: boolean) {
    socketClient.emit('host:override_answer_validation', {
      roomCode,
      answerId,
      isCorrect,
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
    setPresentationOpen(false)
  }

  function emitAudio(action: 'play' | 'pause' | 'seek') {
    const audio = hostAudioRef.current
    if (!audio || !roomCode) return
    socketClient.emit(`host:audio_${action}`, {
      roomCode,
      position: audio.currentTime ?? 0,
    })
  }

  return (
    <PageCard
      className="page-card-host"
      title="Session (Host)"
      description="Tout ce qu’il faut pour animer la partie, en grand et au calme."
      eyebrow="Hôte"
      actions={
        <div className="toolbar-actions">
          {status === 'FINISHED' ? (
            <Button onClick={handleResetSession} type="button" variant="secondary" size="lg">
              Relancer une session
            </Button>
          ) : null}
          <Button
            onClick={handleStartQuiz}
            type="button"
            variant="primary"
            size="lg"
            disabled={!canStartQuiz}
          >
            Démarrer le quiz
          </Button>
        </div>
      }
    >
      {error ? <p className="form-error">{error}</p> : null}

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
                  : 'La présentation s’ouvre dans une modal (plus propre pour le QR code et le contrôle host).'
              }
            />
          )}

          <div className="player-list-panel">
            <h3>Joueurs</h3>
            {status === 'QUESTION_ACTIVE' ? (
              <p className="room-answers-hint">
                Répondu {answerCount?.answersReceived ?? 0} /{' '}
                {answerCount?.playersCount ??
                  (room?.players ?? []).filter((player) => player.connected).length ??
                  0}
              </p>
            ) : null}
            {(room?.players ?? []).length ? (
              <div className="player-list">
                {(room?.players ?? []).map((player) => (
                  <div className="player-row" key={player.playerId}>
                    <span>{player.nickname}</span>
                    <small>
                      {player.connected ? 'connecté' : 'parti'} — {player.score ?? 0} pts
                      {status === 'QUESTION_ACTIVE' && player.connected ? (
                        answeredPlayerIds.has(player.playerId) ? ' — a répondu' : ' — en attente'
                      ) : null}
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

      <Modal
        open={presentationOpen}
        title={
          isRevealPhase
            ? `Révélation — slide ${revealIndex + 1} / ${totalSlides}`
            : `Quiz — slide ${currentIndex + 1} / ${totalSlides}`
        }
        onClose={() => setPresentationOpen(false)}
        footer={
          isRevealPhase ? (
            <div className="ui-modal-footer-row">
              <div className="ui-modal-footer-left">
                <Button onClick={handlePrevRevealSlide} type="button" variant="secondary">
                  Précédent
                </Button>
                <Button onClick={handleRevealCurrentSlide} type="button" variant="secondary">
                  Révéler (recharger)
                </Button>
              </div>
              <div className="ui-modal-footer-right">
                <Button
                  onClick={handleNextRevealSlide}
                  type="button"
                  variant="primary"
                  disabled={!canGoNextReveal}
                >
                  Suivant
                </Button>
                <Button onClick={handleFinishQuiz} type="button" variant="primary">
                  Terminer
                </Button>
              </div>
            </div>
          ) : (
            <div className="ui-modal-footer-row">
              <div className="ui-modal-footer-left">
                <Button
                  onClick={handlePrevSlide}
                  type="button"
                  variant="secondary"
                  disabled={!canNavigateSlides || currentIndex <= 0}
                >
                  Précédent
                </Button>
                <Button
                  onClick={handleLockAnswers}
                  type="button"
                  variant="secondary"
                  disabled={!canLockAnswers}
                >
                  Verrouiller
                </Button>
              </div>
              <div className="ui-modal-footer-right">
                {canStartReveal ? (
                  <Button onClick={handleStartReveal} type="button" variant="primary">
                    Démarrer le reveal
                  </Button>
                ) : null}
                <Button
                  onClick={handleNextSlide}
                  type="button"
                  variant="primary"
                  disabled={!canNavigateSlides || (totalSlides > 0 && currentIndex >= totalSlides - 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )
        }
      >
        {isRevealPhase && reveal ? (
          <>
            <Scoreboard players={room?.players ?? []} title="Scores" />
            <RevealPanel
              isHost
              onOverrideAnswer={handleOverrideAnswerValidation}
              reveal={reveal}
            />
          </>
        ) : status === 'FINISHED' ? (
          <EmptyState title="Partie terminée" description="Tu peux fermer la présentation." />
        ) : (
          <div
            className="slide-canvas-stage host-live-stage"
            style={{ background: currentSlide?.backgroundColor ?? undefined }}
          >
            <SlideCanvas
              elements={(currentSlide?.elements as any) ?? null}
              legacyImageUrl={currentSlide?.imageUrl ?? null}
              legacyQuestion={currentSlide?.question ?? null}
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
        )}
      </Modal>
    </PageCard>
  )
}
