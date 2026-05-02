import type { SlideElement } from './quiz'

export type RoomStatus =
  | 'WAITING_ROOM'
  | 'QUESTION_ACTIVE'
  | 'QUESTION_LOCKED'
  | 'REVEAL_PHASE'
  | 'FINISHED'

export type RoomPlayer = {
  playerId: string
  userId: string | null
  nickname: string
  avatarUrl: string | null
  score: number
  connected: boolean
  joinedAt: string
}

export type RoomSummary = {
  id: string
  quizId: string
  hostId: string
  code: string
  status: RoomStatus
  currentSlideIndex: number
  revealSlideIndex: number
  players: RoomPlayer[]
  quizTitle: string | null
  totalSlides: number
  answersCount?: number
  joinUrl: string | null
  createdAt?: string
  updatedAt?: string
  finishedAt?: string | null
}

export type RoomInvite = {
  code: string
  status: RoomStatus
  quizTitle: string | null
  hostName: string | null
  connectedPlayersCount: number
  totalPlayersCount: number
  joinUrl: string | null
}

export type RoomCreatePayload = {
  quizId: string
}

export type LiveSlide = {
  id?: string
  type?: string
  title?: string
  question?: string
  description?: string | null
  imageUrl?: string | null
  backgroundColor?: string | null
  elements?: SlideElement[] | null
  points?: number
  answerMode?: string
  audio?: {
    sourceType?: string
    sourceUrl?: string
    storedFileUrl?: string
    startTime?: number
    endTime?: number
    duration?: number
  } | null
  answers?: Array<{
    id?: string
    text?: string
    isCorrect?: boolean
  }>
}

export type SlideStartedPayload = {
  slide: LiveSlide
  currentSlideIndex: number
  totalSlides: number
}

export type AnswerCountPayload = {
  roomCode: string
  slideId: string | null
  answersReceived: number
  playersCount: number
  currentSlideIndex: number
  answeredPlayerIds?: string[]
}

export type AnswerReceivedPayload = {
  answerId: string
  roomId: string
  quizId: string
  slideId: string
  playerId: string
  userId: string | null
  answer: string
  submittedAt: string
}

export type RevealedAnswer = AnswerReceivedPayload & {
  nickname: string
  isCorrect: boolean | null
  pointsAwarded: number
  validation: {
    method: string
    confidence?: number | null
    reason?: string | null
    validatedBy?: string | null
  }
}

export type CorrectAnswerPayload = {
  type?: string
  answers?: Array<{
    id?: string
    text?: string
  }>
  expectedAnswer?: string | null
}

export type RevealPayload = {
  roomCode: string
  slide: LiveSlide
  revealSlideIndex: number
  totalSlides: number
  answers: RevealedAnswer[]
  correctAnswer: CorrectAnswerPayload
  validationState: {
    totalAnswers: number
    validatedAnswers: number
  }
}

export type ScoreUpdatedPayload = {
  roomCode: string
  players: Array<{
    playerId: string
    nickname: string
    score: number
  }>
}

export type AnswerValidationUpdatedPayload = RevealedAnswer

export type SlidePointsValidatedPayload = {
  roomCode: string
  slideId: string
  revealSlideIndex: number
}

export type AudioControlPayload = {
  roomCode: string
  action: 'play' | 'pause' | 'seek'
  position: number
  sentAt: number
  slideId?: string
  audioUrl?: string
}

export type CanvasElementHiddenPayload = {
  roomCode: string
  slideId?: string
  elementId: string
  sentAt: number
}

export type PlayerJoinAck = {
  player?: RoomPlayer
  room?: RoomSummary
  ok?: boolean
  error?: string
}
