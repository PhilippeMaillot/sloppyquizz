export type Participation = {
  id: string
  quizId: string
  quizTitle?: string | null
  quizCoverImageUrl?: string | null
  roomId: string
  playerId: string
  userId?: string | null
  nickname: string
  score: number
  rank: number
  correctAnswersCount: number
  answers: unknown[]
  playedAt: string
}

export type RoomResults = {
  roomId: string
  quizId: string
  quizTitle?: string | null
  finishedAt: string
  results: Participation[]
}

