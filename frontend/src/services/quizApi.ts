import { apiClient } from './apiClient'
import type {
  QuizCreatePayload,
  QuizSummary,
  QuizUpdatePayload,
} from '../types/quiz'

export const quizApi = {
  getStatus: () => apiClient.get('/quizzes/status'),
  createQuiz: async (payload: QuizCreatePayload) => {
    const response = await apiClient.post<QuizSummary>('/quizzes', payload)
    return response.data
  },
  listMyQuizzes: async () => {
    const response = await apiClient.get<QuizSummary[]>('/quizzes')
    return response.data
  },
  getQuiz: async (quizId: string) => {
    const response = await apiClient.get<QuizSummary>(`/quizzes/${quizId}`)
    return response.data
  },
  updateQuiz: async (quizId: string, payload: QuizUpdatePayload) => {
    const response = await apiClient.put<QuizSummary>(`/quizzes/${quizId}`, payload)
    return response.data
  },
  deleteQuiz: async (quizId: string) => {
    await apiClient.delete(`/quizzes/${quizId}`)
  },
}
