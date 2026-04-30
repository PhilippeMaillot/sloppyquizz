export type AuthUser = {
  id: string
  username: string
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  stats: {
    totalPoints: number
    quizzesCreated: number
    quizzesPlayed: number
    wins: number
  }
}

export type AuthResponse = {
  accessToken: string
  user: AuthUser
}

export type RegisterPayload = {
  username: string
  password: string
}

export type LoginPayload = {
  username: string
  password: string
}
