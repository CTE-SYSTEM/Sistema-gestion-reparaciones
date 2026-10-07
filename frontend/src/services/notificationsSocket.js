import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
  return window.location.origin;
};

export const createNotificationsSocket = () => {
  if (import.meta.env.VITE_NOTIFICATIONS_MODE === 'poll') return null;
  const token = sessionStorage.getItem('token');
  if (!token) return null;

  return io(getSocketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
};
