import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Al iniciar, intentar recuperar la sesión
        const storedUser = localStorage.getItem('pianoflow_user');
        const token = localStorage.getItem('pianoflow_token');
        
        if (storedUser && token) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = (userData, token) => {
        setUser(userData);
        localStorage.setItem('pianoflow_user', JSON.stringify(userData));
        localStorage.setItem('pianoflow_token', token);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('pianoflow_user');
        localStorage.removeItem('pianoflow_token');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
