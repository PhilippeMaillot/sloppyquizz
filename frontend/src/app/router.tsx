import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom'

import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { AppLayout } from '../components/layout/AppLayout'
import { DashboardPage } from '../pages/DashboardPage'
import { HostRoomPage } from '../pages/HostRoomPage'
import { JoinRoomPage } from '../pages/JoinRoomPage'
import { LoginPage } from '../pages/LoginPage'
import { LeaderboardPage } from '../pages/LeaderboardPage'
import { MyParticipationsPage } from '../pages/MyParticipationsPage'
import { PlayerRoomPage } from '../pages/PlayerRoomPage'
import { QuizEditorPage } from '../pages/QuizEditorPage'
import { RegisterPage } from '../pages/RegisterPage'
import { ResultsPage } from '../pages/ResultsPage'
import { useAuthStore } from '../stores/authStore'

function HomeRedirect() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()
  return (
    <Navigate
      to={isAuthenticated ? '/dashboard' : '/login'}
      replace
      state={isAuthenticated ? undefined : { from: location }}
    />
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomeRedirect />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: 'dashboard',
            element: <DashboardPage />,
          },
          {
            path: 'participations',
            element: <MyParticipationsPage />,
          },
          {
            path: 'quizzes/:quizId/edit',
            element: <QuizEditorPage />,
          },
          {
            path: 'host/:roomCode',
            element: <HostRoomPage />,
          },
        ],
      },
      {
        path: 'join/:roomCode?',
        element: <JoinRoomPage />,
      },
      {
        path: 'play/:roomCode',
        element: <PlayerRoomPage />,
      },
      {
        path: 'results/:roomId',
        element: <ResultsPage />,
      },
      {
        path: 'leaderboards/global',
        element: <LeaderboardPage />,
      },
      {
        path: 'leaderboards/quiz/:quizId',
        element: <LeaderboardPage />,
      },
    ],
  },
])
