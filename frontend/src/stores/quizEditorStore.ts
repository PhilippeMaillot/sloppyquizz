import { create } from 'zustand'

type QuizEditorState = {
  selectedSlideId: string | null
  hasUnsavedChanges: boolean
  setSelectedSlideId: (slideId: string | null) => void
  setHasUnsavedChanges: (value: boolean) => void
}

export const useQuizEditorStore = create<QuizEditorState>((set) => ({
  selectedSlideId: null,
  hasUnsavedChanges: false,
  setSelectedSlideId: (slideId) => set({ selectedSlideId: slideId }),
  setHasUnsavedChanges: (value) => set({ hasUnsavedChanges: value }),
}))

