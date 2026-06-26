import React, { useEffect, useState } from 'react';

const SessionManager = ({ children }) => {
    const [isActiveTab, setIsActiveTab] = useState(true);
    
    // Generar un ID único para esta pestaña al cargar
    const [tabId] = useState(() => Math.random().toString(36).substring(2, 9));

    useEffect(() => {
        const bc = new BroadcastChannel('pianoflow_session');

        // Cuando la pestaña carga, le avisa a todas las demás que ella es la activa
        bc.postMessage({ type: 'CLAIM_ACTIVE', tabId });

        const handleMessage = (event) => {
            const data = event.data;
            if (data.type === 'CLAIM_ACTIVE' && data.tabId !== tabId) {
                // Otra pestaña reclamó el control, nos desactivamos
                setIsActiveTab(false);
            }
        };

        bc.addEventListener('message', handleMessage);

        return () => {
            bc.removeEventListener('message', handleMessage);
            bc.close();
        };
    }, [tabId]);

    const claimSession = () => {
        const bc = new BroadcastChannel('pianoflow_session');
        bc.postMessage({ type: 'CLAIM_ACTIVE', tabId });
        bc.close();
        setIsActiveTab(true);
    };

    if (!isActiveTab) {
        return (
            <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.95)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'white',
                fontFamily: 'sans-serif'
            }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
                <h1 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Sesión activa en otra ventana</h1>
                <p style={{ color: '#aaa', marginBottom: '2rem', textAlign: 'center', maxWidth: '400px' }}>
                    PianoFlow solo permite tener la aplicación activa en una pestaña a la vez para garantizar el correcto funcionamiento del audio y MIDI.
                </p>
                <button 
                    className="btn-system btn-accent" 
                    onClick={claimSession}
                    style={{ padding: '15px 30px', fontSize: '1.2rem' }}
                >
                    Mostrar aquí
                </button>
            </div>
        );
    }

    return <>{children}</>;
};

export default SessionManager;
