import { io } from 'socket.io-client';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

export const socket = io(BACKEND, {
  autoConnect: false
});

export function ensureSocketConnection(userId) {
  if (!socket.connected) {
    socket.connect();
  }
  if (userId) {
    socket.emit('register_user', { userId });
  }
}

export function joinRoom(room) {
  socket.emit('join', { room });
}
