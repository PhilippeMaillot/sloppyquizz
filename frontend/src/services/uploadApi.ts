import { apiClient } from './apiClient'

export const uploadApi = {
  getStatus: () => apiClient.get('/uploads/status'),
  uploadImage: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post<{ url: string }>(`/uploads/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
  uploadCover: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post<{ url: string }>(`/uploads/cover`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
  uploadVideo: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post<{ url: string }>(`/uploads/video`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}

