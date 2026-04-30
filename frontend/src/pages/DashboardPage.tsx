import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageCard } from '../components/ui/PageCard'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { getBackendOrigin } from '../services/audioApi'
import { quizApi } from '../services/quizApi'
import { roomApi } from '../services/roomApi'
import { useAuthStore } from '../stores/authStore'
import type { QuizSummary } from '../types/quiz'

export function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [launchingQuizId, setLaunchingQuizId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    quizApi
      .listMyQuizzes()
      .then((items) => {
        if (isMounted) {
          setQuizzes(items)
          setError(null)
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Impossible de charger tes quiz.')
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

  async function handleDeleteQuiz(quizId: string) {
    setError(null)

    try {
      await quizApi.deleteQuiz(quizId)
      setQuizzes((items) => items.filter((quiz) => quiz.id !== quizId))
    } catch {
      setError('Impossible de supprimer ce quiz.')
    }
  }

  async function handleLaunchQuiz(quizId: string) {
    setLaunchingQuizId(quizId)
    setError(null)

    try {
      const room = await roomApi.createRoom({ quizId })
      navigate(`/host/${room.code}`)
    } catch {
      setError('Impossible de lancer ce quiz.')
      setLaunchingQuizId(null)
    }
  }

  return (
    <PageCard
      title="Tableau de bord"
      description="Ton atelier secret pour fabriquer des quiz."
      eyebrow="Créateur"
    >
      <div className="dashboard-toolbar">
        <p>
          Connecté en tant que <strong>{user?.username ?? 'user'}</strong>.
        </p>
      </div>

      <section className="dashboard-stats">
        <Card
          title="Mes stats"
          description="Tes totaux depuis le début."
          tone="brand"
        >
          <div className="dashboard-stats-grid">
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Points</span>
              <strong className="dashboard-stat-value">
                {user?.stats?.totalPoints ?? 0}
              </strong>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Quiz joués</span>
              <strong className="dashboard-stat-value">
                {user?.stats?.quizzesPlayed ?? 0}
              </strong>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Victoires</span>
              <strong className="dashboard-stat-value">{user?.stats?.wins ?? 0}</strong>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Quiz créés</span>
              <strong className="dashboard-stat-value">
                {user?.stats?.quizzesCreated ?? quizzes.length ?? 0}
              </strong>
            </div>
          </div>
        </Card>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      {isLoading ? <LoadingState label="Chargement de tes quiz…" /> : null}

      {!isLoading && quizzes.length === 0 ? (
        <EmptyState
          title="Aucun quiz pour le moment"
          description="Crée ton premier quiz et lance une room pour jouer en live."
        />
      ) : null}

      {quizzes.length > 0 ? (
        <div className="quiz-list">
          {quizzes.map((quiz) => (
            <Card
              key={quiz.id}
            >
              <div className="dashboard-quiz-row">
                <div className="dashboard-quiz-cover">
                  {quiz.coverImageUrl ? (
                    <img
                      alt="Cover"
                      loading="lazy"
                      src={
                        quiz.coverImageUrl.startsWith('http://') ||
                        quiz.coverImageUrl.startsWith('https://')
                          ? quiz.coverImageUrl
                          : `${getBackendOrigin()}${quiz.coverImageUrl}`
                      }
                    />
                  ) : (
                    <div className="dashboard-quiz-cover-placeholder">SQ</div>
                  )}
                </div>

                <div className="dashboard-quiz-main">
                  <div className="dashboard-quiz-text">
                    <h3 className="dashboard-quiz-title">{quiz.title}</h3>
                    <p className="dashboard-quiz-desc">
                      {quiz.description || 'Aucune description.'}
                    </p>
                  </div>

                  <div className="dashboard-quiz-meta">
                    <span className="ui-badge ui-badge-info">{quiz.slides.length} slides</span>
                  </div>

                  <div className="dashboard-quiz-actions">
                    <Link className="secondary-button" to={`/quizzes/${quiz.id}/edit`}>
                      Éditer
                    </Link>
                    <Button
                      disabled={launchingQuizId === quiz.id}
                      onClick={() => handleLaunchQuiz(quiz.id)}
                      type="button"
                      variant="primary"
                    >
                      {launchingQuizId === quiz.id ? 'Lancement…' : 'Lancer'}
                    </Button>
                    <Button
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      type="button"
                      variant="danger"
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </PageCard>
  )
}
