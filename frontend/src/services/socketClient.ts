import { io } from 'socket.io-client'

const defaultSocketUrl = window.location.origin

export const socketClient = io(import.meta.env.VITE_SOCKET_URL ?? defaultSocketUrl, {
  autoConnect: false,
  path: '/socket.io',
})
