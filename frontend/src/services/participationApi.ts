import { apiClient } from './apiClient'
import type { Participation } from '../types/participation'

export const participationApi = {
  listMine: async () => {
    const response = await apiClient.get<Participation[]>('/participations/me')
    return response.data
  },
}

