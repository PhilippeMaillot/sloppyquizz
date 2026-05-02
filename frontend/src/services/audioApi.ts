import { apiClient } from './apiClient'
import type { BlindTestAudio } from '../types/quiz'

export type ProcessYoutubeAudioPayload = {
  quizId: string
  slideId: string
  sourceUrl: string
  startTime: number
  endTime: number
}

export type YoutubeAudioPreview = {
  sourceUrl: string
  previewUrl: string
  title: string | null
  duration: number | null
}

export type YoutubeAudioPreviewPayload = {
  quizId: string
  slideId: string
  sourceUrl: string
}

export const audioApi = {
  prepareYoutubePreview: async (payload: YoutubeAudioPreviewPayload) => {
    const response = await apiClient.post<{ preview: YoutubeAudioPreview }>(
      '/audio/youtube-preview',
      payload,
    )
    return response.data.preview
  },

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

