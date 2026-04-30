export type QuestionSlideType =
  | 'single_choice'
  | 'text_answer'
  | 'blind_test'

export type ChoiceAnswer = {
  id: string
  text: string
  isCorrect: boolean
}

export type SlideElementType = 'image' | 'text'

export type SlideElementBase = {
  id: string
  type: SlideElementType
  x: number
  y: number
  w: number
  h: number
  z: number
}

export type SlideImageElement = SlideElementBase & {
  type: 'image'
  imageUrl: string
}

export type SlideTextElement = SlideElementBase & {
  type: 'text'
  text: string
  fontSize?: number
  align?: 'left' | 'center' | 'right'
}

export type SlideElement = SlideImageElement | SlideTextElement

type SlideBase = {
  id: string
  type: QuestionSlideType
  title: string
  question: string
  description: string | null
  imageUrl: string | null
  backgroundColor?: string | null
  elements?: SlideElement[] | null
  points: number
  order: number
}

export type ChoiceSlide = SlideBase & {
  type: 'single_choice'
  answers: ChoiceAnswer[]
}

export type TextAnswerSlide = SlideBase & {
  type: 'text_answer'
  expectedAnswer: string
  manualValidationRequired: boolean
}

export type BlindTestAudio = {
  sourceType: 'youtube'
  sourceUrl: string
  storedFileUrl: string
  startTime: number
  endTime: number
  duration: number
}

export type BlindTestAnswerMode = 'text' | 'single_choice'

export type BlindTestSlide = SlideBase & {
  type: 'blind_test'
  audio: BlindTestAudio | null
  answerMode: BlindTestAnswerMode
  expectedAnswer: string
  answers: ChoiceAnswer[]
}

export type QuizSlide = ChoiceSlide | TextAnswerSlide | BlindTestSlide

export type QuizSummary = {
  id: string
  creatorId: string
  title: string
  description: string
  coverImageUrl: string | null
  visibility: 'private' | 'public'
  slides: QuizSlide[]
  settings: {
    revealMode: 'end_only'
    allowLateJoin: boolean
    manualValidation: boolean
    shuffleQuestions: boolean
    shuffleAnswers: boolean
  }
  createdAt: string
  updatedAt: string
}

export type QuizCreatePayload = {
  title: string
  description?: string
  coverImageUrl?: string | null
  visibility?: 'private' | 'public'
  slides?: QuizSlide[]
}

export type QuizUpdatePayload = Partial<QuizCreatePayload> & {
  settings?: QuizSummary['settings']
}
