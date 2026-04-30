import { create } from 'zustand'

import { AUTH_TOKEN_STORAGE_KEY } from '../services/apiClient'
import type { AuthUser } from '../types/auth'

type AuthState = {
  accessToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  setSession: (token: string, user: AuthUser) => void
  setUser: (user: AuthUser | null) => void
  clear: () => void
}

const initialToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: initialToken,
  user: null,
  isAuthenticated: Boolean(initialToken),
  setSession: (token, user) => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
    set({
      accessToken: token,
      user,
      isAuthenticated: true,
    })
  },
  setUser: (user) =>
    set({
      user,
      isAuthenticated: Boolean(user || localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)),
    }),
  clear: () => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    })
  },
}))
