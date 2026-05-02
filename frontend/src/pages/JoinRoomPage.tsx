import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { PageCard } from '../components/ui/PageCard'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { FormField, Input } from '../components/ui/FormField'
import { roomApi } from '../services/roomApi'
import { socketClient } from '../services/socketClient'
import type { PlayerJoinAck, RoomInvite } from '../types/room'
import { useAuthStore } from '../stores/authStore'
import { createAuthRedirectState } from '../utils/authRedirect'

const PLAYER_SESSION_KEY = 'sloppyquizz.playerSession'

export function JoinRoomPage() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [code, setCode] = useState(roomCode ?? '')
  const [roomInfo, setRoomInfo] = useState<RoomInvite | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [wsError, setWsError] = useState<string | null>(null)

  const cleanCode = useMemo(() => code.trim().toUpperCase(), [code])
  const authRedirectState = useMemo(() => createAuthRedirectState(location), [location])

  useEffect(() => {
    if (!cleanCode || cleanCode.length !== 6) {
      setRoomInfo(null)
      return
    }

    let isMounted = true
    setIsChecking(true)
    setError(null)

    roomApi
      .getRoomInviteByCode(cleanCode)
      .then((info) => {
        if (!isMounted) return
        setRoomInfo(info)
      })
      .catch((err) => {
        if (!isMounted) return
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 410) {
          setError('Cette room est terminée.')
        } else {
          setError('Room introuvable.')
        }
        setRoomInfo(null)
      })
      .finally(() => {
        if (!isMounted) return
        setIsChecking(false)
      })

    return () => {
      isMounted = false
    }
  }, [cleanCode])

  useEffect(() => {
    const handleConnectError = () => setWsError('Connexion au live impossible. Réessaie.')
    socketClient.on('connect_error', handleConnectError)
    return () => {
      socketClient.off('connect_error', handleConnectError)
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanNickname = user?.username?.trim() ?? ''
    setError(null)
    setWsError(null)
    setIsJoining(true)

    try {
      if (!accessToken) {
        setError("Connexion requise pour rejoindre une room.")
        setIsJoining(false)
        return
      }
      if (!cleanNickname) {
        setError("Impossible de récupérer ton pseudo. Recharge la page.")
        setIsJoining(false)
        return
      }
      const info = await roomApi.getRoomInviteByCode(cleanCode)
      if (info.status === 'FINISHED') {
        setError('Cette room est terminée.')
        setIsJoining(false)
        return
      }
      socketClient.auth = { token: accessToken }
      if (!socketClient.connected) {
        socketClient.connect()
      }

      socketClient.emit(
        'player:join_room',
        { roomCode: cleanCode, nickname: cleanNickname },
        (ack: PlayerJoinAck) => {
          if (ack?.error || !ack?.player) {
            setError(ack?.error ?? 'Impossible de rejoindre cette room.')
            setIsJoining(false)
            return
          }

          sessionStorage.setItem(
            PLAYER_SESSION_KEY,
            JSON.stringify({
              roomCode: cleanCode,
              playerId: ack.player.playerId,
              nickname: ack.player.nickname,
            }),
          )
          navigate(`/play/${cleanCode}`)
        },
      )
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 410) {
        setError('Cette room est terminée.')
      } else {
        setError('Room introuvable.')
      }
      setIsJoining(false)
    }
  }

  return (
    <PageCard
      title="Rejoindre une room"
      description="Entre le code de la room."
      eyebrow="Joueur"
    >
      {!isAuthenticated ? (
        <div className="auth-form">
          <EmptyState
            title="Connexion requise"
            description="Pour participer (scores, historique, classements), tu dois être connecté."
            actions={
              <>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/login', { state: authRedirectState })}
                >
                  Se connecter
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/register', { state: authRedirectState })}
                >
                  Créer un compte
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
        {roomInfo?.quizTitle ? (
          <EmptyState
            title={roomInfo.quizTitle}
            description={`Host ${roomInfo.hostName ?? '—'} · ${roomInfo.connectedPlayersCount}/${roomInfo.totalPlayersCount} connectés`}
          />
        ) : null}

        <FormField label="Code de room" hint="6 caractères (lettres/chiffres).">
          <Input
            maxLength={6}
            minLength={6}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            required
            type="text"
            value={code}
          />
        </FormField>

        {error ? <p className="form-error">{error}</p> : null}
        {wsError ? <p className="form-error">{wsError}</p> : null}

        <Button disabled={isJoining || isChecking} size="lg" type="submit" variant="primary">
          {isJoining ? 'Connexion…' : isChecking ? 'Vérification…' : 'Rejoindre'}
        </Button>
        </form>
      )}
    </PageCard>
  )
}

export { PLAYER_SESSION_KEY }
