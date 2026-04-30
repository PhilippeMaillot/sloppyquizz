import { apiClient } from './apiClient'
import type { GlobalLeaderboardEntry, QuizLeaderboardEntry } from '../types/leaderboard'

export const leaderboardApi = {
  getGlobal: async (params?: { limit?: number; offset?: number }) => {
    const response = await apiClient.get<GlobalLeaderboardEntry[]>('/leaderboards/global', {
      params,
    })
    return response.data
  },
  getQuiz: async (quizId: string, params?: { limit?: number; offset?: number }) => {
    const response = await apiClient.get<QuizLeaderboardEntry[]>(
      `/leaderboards/quiz/${quizId}`,
      { params },
    )
    return response.data
  },
}

