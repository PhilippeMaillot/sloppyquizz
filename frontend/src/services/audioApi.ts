import { apiClient } from './apiClient'
import type { BlindTestAudio } from '../types/quiz'

export type ProcessYoutubeAudioPayload = {
  quizId: string
  slideId: string
  sourceUrl: string
  startTime: number
  endTime: number
}

export const audioApi = {
  processYoutube: async (payload: ProcessYoutubeAudioPayload) => {
    const response = await apiClient.post<{ audio: BlindTestAudio }>(
      '/audio/process-youtube',
      payload,
    )
    return response.data.audio
  },
}

export function getBackendOrigin() {
  const base = apiClient.defaults.baseURL ?? ''
  return base.replace(/\/api\/?$/, '')
}

