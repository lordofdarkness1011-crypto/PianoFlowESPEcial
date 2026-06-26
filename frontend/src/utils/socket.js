import { io } from 'socket.io-client';

// Usa la variable de entorno para producción, o localhost:3000 para desarrollo local
const URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

export const socket = io(URL, {
    autoConnect: false // Solo conectamos cuando entramos a la sala
});
