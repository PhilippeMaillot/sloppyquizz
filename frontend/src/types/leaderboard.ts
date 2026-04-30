export type QuizLeaderboardEntry = {
  rank: number
  quizId: string
  userId: string | null
  nickname: string
  bestScore: number
  lastScore: number
  timesPlayed: number
  updatedAt: string
}

export type GlobalLeaderboardEntry = {
  rank: number
  userId: string | null
  nickname: string
  totalPoints: number
  quizzesPlayed: number
  wins: number
  updatedAt: string
}

