import { apiClient } from './apiClient'
import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from '../types/auth'

export const authApi = {
  getStatus: () => apiClient.get('/auth/status'),
  register: async (payload: RegisterPayload) => {
    const response = await apiClient.post<AuthResponse>('/auth/register', payload)
    return response.data
  },
  login: async (payload: LoginPayload) => {
    const response = await apiClient.post<AuthResponse>('/auth/login', payload)
    return response.data
  },
  me: async () => {
    const response = await apiClient.get<AuthUser>('/auth/me')
    return response.data
  },
}
