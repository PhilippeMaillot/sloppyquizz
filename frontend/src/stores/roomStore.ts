import { create } from 'zustand'

import type { LiveSlide, RoomPlayer, RoomStatus } from '../types/room'

type RoomState = {
  roomCode: string | null
  roomStatus: RoomStatus | null
  currentSlideIndex: number
  players: RoomPlayer[]
  currentSlide: LiveSlide | null
  playerId: string | null
  nickname: string | null
  setRoomCode: (roomCode: string | null) => void
  setRoomStatus: (status: RoomStatus | null) => void
  setCurrentSlideIndex: (index: number) => void
  setPlayers: (players: RoomPlayer[]) => void
  setCurrentSlide: (slide: LiveSlide | null) => void
  setPlayerSession: (playerId: string | null, nickname: string | null) => void
  resetRoom: () => void
}

export const useRoomStore = create<RoomState>((set) => ({
  roomCode: null,
  roomStatus: null,
  currentSlideIndex: 0,
  players: [],
  currentSlide: null,
  playerId: null,
  nickname: null,
  setRoomCode: (roomCode) => set({ roomCode }),
  setRoomStatus: (status) => set({ roomStatus: status }),
  setCurrentSlideIndex: (index) => set({ currentSlideIndex: index }),
  setPlayers: (players) => set({ players }),
  setCurrentSlide: (slide) => set({ currentSlide: slide }),
  setPlayerSession: (playerId, nickname) => set({ playerId, nickname }),
  resetRoom: () =>
    set({
      roomCode: null,
      roomStatus: null,
      currentSlideIndex: 0,
      players: [],
      currentSlide: null,
      playerId: null,
      nickname: null,
    }),
}))
