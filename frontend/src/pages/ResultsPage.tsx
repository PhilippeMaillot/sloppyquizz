import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Scoreboard } from '../components/room/Scoreboard'
import { PageCard } from '../components/ui/PageCard'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { roomApi } from '../services/roomApi'
import { useAuthStore } from '../stores/authStore'
import type { RoomPlayer } from '../types/room'
import type { RoomResults } from '../types/participation'

function toRoomPlayers(results: RoomResults): RoomPlayer[] {
  return results.results.map((p) => ({
    playerId: p.playerId,
    userId: p.userId ?? null,
    nickname: p.nickname,
    avatarUrl: null,
    score: p.score,
    connected: true,
    joinedAt: results.finishedAt,
  }))
}

export function ResultsPage() {
  const { roomId } = useParams()
  const user = useAuthStore((state) => state.user)
  const [results, setResults] = useState<RoomResults | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) {
      return
    }

    let isMounted = true
    setIsLoading(true)
    setError(null)

    roomApi
      .getRoomResults(roomId)
      .then((data) => {
        if (isMounted) {
          setResults(data)
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Impossible de charger les résultats de cette room.")
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [roomId])

  return (
    <PageCard
      title="Résultats"
      description="Classement final de la session et détails des participations."
      eyebrow="GG !"
    >
      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? <LoadingState label="Chargement des résultats…" /> : null}

      {results ? (
        <>
          <Card
            title={results.quizTitle ?? 'Quiz'}
            tone="brand"
          />

          <Scoreboard players={toRoomPlayers(results)} title="Classement final" />

          <section className="results-list">
            <h3>Détails</h3>
            <div className="scoreboard-list">
              {results.results.map((p) => (
                <div className="scoreboard-row" key={p.id}>
                  <span className="scoreboard-rank">#{p.rank}</span>
                  <span className="scoreboard-name">{p.nickname}</span>
                  <strong className="scoreboard-score">{p.score}</strong>
                  <small>
                    {typeof p.correctAnswersCount === 'number'
                      ? `${p.correctAnswersCount} bonnes réponses`
                      : null}
                  </small>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : !isLoading && !error ? (
        <EmptyState title="Aucun résultat" description="Cette room n’est pas terminée ou introuvable." />
      ) : null}

      {!user ? (
        <div className="toolbar-actions">
          <Link className="secondary-button" to="/login">
            Se connecter
          </Link>
        </div>
      ) : null}
    </PageCard>
  )
}
