import React, { createContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const socketRef = useRef(null);

    // Obtener o generar deviceId único para este navegador
    const getDeviceId = () => {
        let deviceId = localStorage.getItem('pianoflow_device_id');
        if (!deviceId) {
            deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('pianoflow_device_id', deviceId);
        }
        return deviceId;
    };

    useEffect(() => {
        // Al iniciar, intentar recuperar la sesión
        const storedUser = localStorage.getItem('pianoflow_user');
        const token = localStorage.getItem('pianoflow_token');
        
        if (storedUser && token) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setupSessionSocket(parsedUser.id);
        }
        setLoading(false);

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    const setupSessionSocket = (userId) => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;
        const socket = io(API_URL);
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('register_session', {
                userId,
                deviceId: getDeviceId()
            });
        });

        socket.on('force_logout', (message) => {
            alert(message || 'Has iniciado sesión en otro dispositivo. Tu sesión aquí será cerrada.');
            logout(true); // true para evitar bucles de socket
            window.location.href = '/'; // Redirigir al root agresivamente
        });
    };

    const login = (userData, token) => {
        setUser(userData);
        localStorage.setItem('pianoflow_user', JSON.stringify(userData));
        localStorage.setItem('pianoflow_token', token);
        setupSessionSocket(userData.id);
    };

    const logout = (fromSocket = false) => {
        setUser(null);
        localStorage.removeItem('pianoflow_user');
        localStorage.removeItem('pianoflow_token');
        
        if (!fromSocket && socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
