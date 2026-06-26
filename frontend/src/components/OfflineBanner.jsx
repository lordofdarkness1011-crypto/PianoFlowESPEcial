import React, { useState, useEffect } from 'react';

const OfflineBanner = () => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOffline = () => setIsOffline(true);
        const handleOnline = () => setIsOffline(false);

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div style={{
            background: '#ef4444',
            color: 'white',
            padding: '10px',
            textAlign: 'center',
            fontWeight: '600',
            position: 'sticky',
            top: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)'
        }}>
            <span style={{ fontSize: '1.2rem' }}>📡</span> 
            <span>Conexión de red interrumpida. Operando en Modo Offline (Caché).</span>
        </div>
    );
};

export default OfflineBanner;
