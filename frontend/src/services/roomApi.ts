import { apiClient } from './apiClient'
import type { RoomCreatePayload, RoomInvite, RoomSummary } from '../types/room'
import type { RoomResults } from '../types/participation'

export const roomApi = {
  getStatus: () => apiClient.get('/rooms/status'),
  createRoom: async (payload: RoomCreatePayload) => {
    const response = await apiClient.post<RoomSummary>('/rooms', payload)
    return response.data
  },
  getRoomInviteByCode: async (code: string) => {
    const response = await apiClient.get<RoomInvite>(`/rooms/code/${code}`)
    return response.data
  },
  getHostRoomByCode: async (code: string) => {
    const response = await apiClient.get<RoomSummary>(`/rooms/host/code/${code}`)
    return response.data
  },
  getRoomResults: async (roomId: string) => {
    const response = await apiClient.get<RoomResults>(`/rooms/${roomId}/results`)
    return response.data
  },
}
