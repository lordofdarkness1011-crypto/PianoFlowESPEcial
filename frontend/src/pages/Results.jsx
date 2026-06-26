import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Results = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const stats = location.state?.stats;
    const song = location.state?.song;
    const config = location.state?.config;

    if (!stats || !song) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>
                <h2>No hay resultados disponibles.</h2>
                <button className="btn-system" onClick={() => navigate('/dashboard/songs')}>Volver a Canciones</button>
            </div>
        );
    }

    const { totalNotes, hits, misses, maxCombo } = stats;
    const accuracy = totalNotes > 0 ? ((hits / totalNotes) * 100).toFixed(1) : 0;

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column' }}>
            <div className="system-panel" style={{ width: '500px', textAlign: 'center' }}>
                <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>¡Canción Terminada!</h1>
                <h2 style={{ color: 'white', marginBottom: '2rem', fontWeight: 500 }}>{song.title}</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                        <p style={{ color: 'var(--text-muted)', margin: '0 0 5px 0' }}>Precisión</p>
                        <p style={{ fontSize: '2rem', margin: 0, color: accuracy >= 80 ? '#10b981' : '#f59e0b' }}>
                            {accuracy}%
                        </p>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                        <p style={{ color: 'var(--text-muted)', margin: '0 0 5px 0' }}>Combo Máximo</p>
                        <p style={{ fontSize: '2rem', margin: 0, color: '#38bdf8' }}>
                            {maxCombo}
                        </p>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                        <p style={{ color: 'var(--text-muted)', margin: '0 0 5px 0' }}>Aciertos</p>
                        <p style={{ fontSize: '1.5rem', margin: 0, color: 'white' }}>
                            {hits} <span style={{ fontSize: '1rem', color: '#666' }}>/ {totalNotes}</span>
                        </p>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                        <p style={{ color: 'var(--text-muted)', margin: '0 0 5px 0' }}>Fallos</p>
                        <p style={{ fontSize: '1.5rem', margin: 0, color: misses > 0 ? '#ef4444' : '#10b981' }}>
                            {misses}
                        </p>
                    </div>
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                    Modo: {config.mode === 'wait' ? 'Espera' : 'Normal'} | Vel: {config.speed}x | Manos: {config.hands}
                </div>

                <button 
                    className="btn-system btn-accent" 
                    style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}
                    onClick={() => navigate('/dashboard/songs')}
                >
                    Continuar
                </button>
            </div>
        </div>
    );
};

export default Results;
