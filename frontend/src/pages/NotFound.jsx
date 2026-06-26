import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
    const navigate = useNavigate();
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-base)', flexDirection: 'column', padding: '2rem' }}>
            <div className="system-panel" style={{ textAlign: 'center', maxWidth: '400px' }}>
                <h1 className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '4rem', margin: 0 }}>404</h1>
                <h2 style={{ margin: '0 0 1rem 0' }}>Ruta Desconocida</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    El sector de memoria que buscas no está mapeado en este nodo.
                </p>
                <button 
                    className="btn-system btn-accent" 
                    onClick={() => navigate('/dashboard')}
                >
                    Volver al Inicio
                </button>
            </div>
        </div>
    );
};

export default NotFound;
