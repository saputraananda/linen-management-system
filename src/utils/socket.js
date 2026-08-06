import { io } from 'socket.io-client';

// Dynamically resolve backend socket URL for both localhost, local network IPs, and production
const socketUrl = import.meta.env.DEV 
  ? `${window.location.protocol}//${window.location.hostname}:5000` 
  : window.location.origin;

export const socket = io(socketUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000
});
