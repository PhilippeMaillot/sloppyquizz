import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageCard } from '../components/ui/PageCard'
import { participationApi } from '../services/participationApi'
import type { Participation } from '../types/participation'
import { getBackendOrigin } from '../services/audioApi'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export function MyParticipationsPage() {
  const [items, setItems] = useState<Participation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setError(null)

    participationApi
      .listMine()
      .then((data) => {
        if (isMounted) {
          setItems(data)
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Impossible de charger l'historique des participations.")
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
  }, [])

  return (
    <PageCard
      title="Mes participations"
      description="Retrouve tes scores et tes rangs, même après rechargement."
    >
      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? <p>Chargement...</p> : null}

      {!isLoading && items.length === 0 ? (
        <div className="empty-state">
          <h3>Aucune participation</h3>
          <p>Termine une partie pour voir apparaître ton historique ici.</p>
        </div>
      ) : null}

      {items.length ? (
        <div className="quiz-list">
          {items.map((p) => (
            <article className="quiz-card" key={p.id}>
              <div className="participation-row">
                <div className="participation-cover" aria-hidden="true">
                  {p.quizCoverImageUrl ? (
                    <img
                      alt=""
                      src={
                        p.quizCoverImageUrl.startsWith('http://') || p.quizCoverImageUrl.startsWith('https://')
                          ? p.quizCoverImageUrl
                          : `${getBackendOrigin()}${p.quizCoverImageUrl}`
                      }
                    />
                  ) : (
                    <div className="participation-cover-placeholder">SQ</div>
                  )}
                </div>

                <div className="participation-main">
                  <h3>{p.quizTitle ?? 'Quiz'}</h3>
                  <p>
                    {formatDate(p.playedAt)} — rang <strong>#{p.rank}</strong>
                  </p>
                  <span>
                    Score <strong>{p.score}</strong>
                  </span>
                </div>

                <div className="quiz-card-actions">
                  <Link className="secondary-button" to={`/results/${p.roomId}`}>
                    Voir résultats
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

    </PageCard>
  )
}
