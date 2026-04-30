import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { PageCard } from '../components/ui/PageCard'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { leaderboardApi } from '../services/leaderboardApi'
import type { GlobalLeaderboardEntry, QuizLeaderboardEntry } from '../types/leaderboard'

type Mode = 'global' | 'quiz'

export function LeaderboardPage() {
  const { quizId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = (searchParams.get('mode') as Mode) || (quizId ? 'quiz' : 'global')

  const limit = Number(searchParams.get('limit') ?? '20') || 20
  const offset = Number(searchParams.get('offset') ?? '0') || 0

  const [globalRows, setGlobalRows] = useState<GlobalLeaderboardEntry[]>([])
  const [quizRows, setQuizRows] = useState<QuizLeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const title = useMemo(() => {
    if (mode === 'quiz') {
      return 'Classement du quiz'
    }
    return 'Classement global'
  }, [mode])

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setError(null)

    const params = { limit: limit + 1, offset }
    const request =
      mode === 'quiz' && quizId
        ? leaderboardApi.getQuiz(quizId, params).then((rows) => {
            if (isMounted) setQuizRows(rows)
          })
        : leaderboardApi.getGlobal(params).then((rows) => {
            if (isMounted) setGlobalRows(rows)
          })

    request
      .catch(() => {
        if (isMounted) setError("Impossible de charger le classement.")
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [limit, mode, offset, quizId])

  function go(nextOffset: number) {
    const next = new URLSearchParams(searchParams)
    next.set('offset', String(Math.max(0, nextOffset)))
    next.set('limit', String(limit))
    next.set('mode', mode)
    setSearchParams(next)
  }

  const fetchedRows = mode === 'quiz' ? quizRows : globalRows
  const hasNextPage = fetchedRows.length > limit
  const rows = fetchedRows.slice(0, limit)
  const showPagination = offset > 0 || hasNextPage

  return (
    <PageCard
      title={title}
      description="Top scores et stats, basés sur les participations validées."
      eyebrow="Hall of Fame"
    >
      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? <LoadingState label="Chargement du classement…" /> : null}

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          title="Aucun score pour le moment"
          description="Termine une partie pour alimenter le classement."
        />
      ) : null}

      {rows.length ? (
        <section className="scoreboard">
          <Card
            title={mode === 'quiz' ? 'Top scores du quiz' : 'Top global'}
            description={mode === 'quiz' ? 'Best score par joueur.' : 'Points cumulés sur tous les quiz.'}
            tone="brand"
          />
          <div className="scoreboard-list">
            {mode === 'quiz'
              ? (rows as QuizLeaderboardEntry[]).map((row) => (
                  <div className="scoreboard-row" key={`${row.quizId}-${row.nickname}-${row.rank}`}>
                    <span className="scoreboard-rank">#{row.rank}</span>
                    <span className="scoreboard-name">{row.nickname}</span>
                    <strong className="scoreboard-score">{row.bestScore}</strong>
                    <small>
                      dernier {row.lastScore} — {row.timesPlayed} parties
                    </small>
                  </div>
                ))
              : (rows as GlobalLeaderboardEntry[]).map((row) => (
                  <div className="scoreboard-row" key={`${row.nickname}-${row.rank}`}>
                    <span className="scoreboard-rank">#{row.rank}</span>
                    <span className="scoreboard-name">{row.nickname}</span>
                    <strong className="scoreboard-score">{row.totalPoints}</strong>
                    <small>
                      nombre de quiz {row.quizzesPlayed} — victoires {row.wins}
                    </small>
                  </div>
                ))}
          </div>
        </section>
      ) : null}

      <div className="toolbar-actions">
        {showPagination ? (
          <>
            <Button
              disabled={offset <= 0}
              onClick={() => go(offset - limit)}
              type="button"
              variant="secondary"
            >
              Précédent
            </Button>
            <Button
              disabled={!hasNextPage}
              onClick={() => go(offset + limit)}
              type="button"
              variant="secondary"
            >
              Suivant
            </Button>
          </>
        ) : null}
        {mode !== 'global' ? (
          <Link className="secondary-button" to="/leaderboards/global">
            Global
          </Link>
        ) : null}
        {quizId ? (
          <Link className="secondary-button" to={`/leaderboards/quiz/${quizId}`}>
            Quiz
          </Link>
        ) : null}
      </div>
    </PageCard>
  )
}
