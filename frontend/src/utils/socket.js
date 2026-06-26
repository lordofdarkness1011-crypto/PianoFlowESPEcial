import { io } from 'socket.io-client';

const URL = `http://${window.location.hostname}:3000`;

export const socket = io(URL, {
    autoConnect: false // Solo conectamos cuando entramos a la sala
});
