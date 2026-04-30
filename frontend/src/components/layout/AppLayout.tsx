import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { AuthSessionLoader } from '../auth/AuthSessionLoader'
import { useAuthStore } from '../../stores/authStore'
import { quizApi } from '../../services/quizApi'

export function AppLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const clearAuth = useAuthStore((state) => state.clear)
  const navigate = useNavigate()
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sloppyquizz.sidebarCollapsed')
      setSidebarCollapsed(saved === null ? true : saved === '1')
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('sloppyquizz.sidebarCollapsed', sidebarCollapsed ? '1' : '0')
    } catch {
      // ignore
    }
  }, [sidebarCollapsed])

  useLayoutEffect(() => {
    const sidebarEl = sidebarRef.current
    const shellEl = shellRef.current
    if (!sidebarEl || !shellEl) return

    const update = () => {
      if (sidebarCollapsed) {
        shellEl.style.removeProperty('--sidebar-width')
        return
      }
      const width = Math.ceil(sidebarEl.getBoundingClientRect().width)
      // Avoid absurd values if the element is not visible yet.
      if (width > 80 && width < 520) {
        shellEl.style.setProperty('--sidebar-width', `${width}px`)
      }
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [sidebarCollapsed, isAuthenticated])

  const navigationItems = isAuthenticated
    ? [
        {
          to: '/dashboard',
          label: 'Tableau de bord',
          icon: (
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path
                d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-4.2v-6.2H9.2V21H5a1 1 0 0 1-1-1v-8.8Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          ),
        },
        {
          to: '/join',
          label: 'Rejoindre une room',
          icon: (
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path
                d="M5 7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-7A3.5 3.5 0 0 1 5 16.5v-9Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M8.5 9.5h7M8.5 14.5h3.5m2.4 0H16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
              <path
                d="M12 17.2v2.3m-2-1.1h4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          ),
        },
        {
          to: '/leaderboards/global',
          label: 'Classement global',
          icon: (
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path
                d="M7 4h10v3a5 5 0 0 1-10 0V4Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path
                d="M7 7H5a2 2 0 0 0 2 2M17 7h2a2 2 0 0 1-2 2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path
                d="M12 12v3m-4 5h8m-6-5h4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          ),
        },
        {
          to: '/participations',
          label: 'Mes participations',
          icon: (
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path
                d="M8 7h8M8 11h6M8 15h7"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
              <path
                d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          ),
        },
      ]
    : [
        {
          to: '/login',
          label: 'Connexion',
          icon: (
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path
                d="M10 7V5.8C10 4.8 10.8 4 11.8 4H17c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-5.2c-1 0-1.8-.8-1.8-1.8V17"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path
                d="M4 12h10m0 0-3-3m3 3-3 3"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          ),
        },
        {
          to: '/register',
          label: 'Inscription',
          icon: (
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path
                d="M8 10a4 4 0 1 0 8 0 4 4 0 0 0-8 0Zm-3 10a7 7 0 0 1 14 0"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path
                d="M19 5v4m-2-2h4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          ),
        },
      ]

  function handleLogout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  async function handleCreateQuiz() {
    setIsCreatingQuiz(true)
    try {
      const quiz = await quizApi.createQuiz({
        title: 'Quiz sans titre',
        description: '',
        visibility: 'private',
        slides: [],
      })
      navigate(`/quizzes/${quiz.id}/edit`)
    } finally {
      setIsCreatingQuiz(false)
    }
  }

  return (
    <div
      className={`app-shell${sidebarCollapsed ? ' app-shell-collapsed' : ''}`}
      ref={shellRef}
    >
      <AuthSessionLoader />
      <aside
        className={`sidebar-nav${sidebarCollapsed ? ' sidebar-nav-collapsed' : ''}`}
        aria-label="Navigation"
        ref={sidebarRef}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand" aria-label="SloppyQuizz">
            SQ
          </div>
        </div>
        {isAuthenticated ? (
          <button
            className="sidebar-nav-button sidebar-nav-button-primary"
            type="button"
            onClick={handleCreateQuiz}
            disabled={isCreatingQuiz}
            aria-label="Créer un quiz"
            title="Créer un quiz"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
            <span className="sidebar-nav-label">
              {isCreatingQuiz ? 'Création…' : 'Créer un quiz'}
            </span>
          </button>
        ) : null}
        <nav className="sidebar-nav-links">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) =>
                `sidebar-nav-button${isActive ? ' sidebar-nav-button-active' : ''}`
              }
            >
              {item.icon}
              <span className="sidebar-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-nav-spacer" />
        <div className="sidebar-bottom-controls">
          <button
            className="sidebar-collapse"
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Développer la sidebar' : 'Réduire la sidebar'}
            title={sidebarCollapsed ? 'Développer' : 'Réduire'}
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path
                d="M14 7l-5 5 5 5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>

        {isAuthenticated ? (
          <button
            aria-label="Déconnexion"
            className="sidebar-nav-button"
            onClick={handleLogout}
            title="Déconnexion"
            type="button"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M10 7V5.8C10 4.8 10.8 4 11.8 4H17c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-5.2c-1 0-1.8-.8-1.8-1.8V17"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path
                d="M14 12H4m0 0 3-3m-3 3 3 3"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span className="sidebar-nav-label">Déconnexion</span>
          </button>
        ) : null}
      </aside>

      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  )
}
