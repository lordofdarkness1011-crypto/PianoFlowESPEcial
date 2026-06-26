import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import songsData from '../data/songs.json';

const SongList = () => {
    const navigate = useNavigate();
    const [selectedMode, setSelectedMode] = useState('wait'); // 'wait' o 'normal'
    const [selectedSpeed, setSelectedSpeed] = useState(1.0); // 0.5, 1.0, 1.5
    const [selectedHands, setSelectedHands] = useState('both'); // 'left', 'right', 'both'

    const handlePlay = (song) => {
        // Navegar a la vista del juego con la configuración
        navigate(`/gameplay/${song.id}`, {
            state: {
                song,
                config: {
                    mode: selectedMode,
                    speed: selectedSpeed,
                    hands: selectedHands
                }
            }
        });
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button 
                    className="btn-system" 
                    onClick={() => navigate('/dashboard')}
                >
                    ← Volver
                </button>
                <h1 className="text-gradient" style={{ margin: 0, fontSize: '2.5rem' }}>Elige una Canción</h1>
            </div>
            
            {/* Opciones Globales */}
            <div className="system-panel" style={{ marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>Modo de Juego</h3>
                    <select 
                        className="system-input" 
                        value={selectedMode} 
                        onChange={(e) => setSelectedMode(e.target.value)}
                    >
                        <option value="wait">Modo Espera (Aprender)</option>
                        <option value="normal">Modo Normal (Desafío)</option>
                        <option value="listening">Listening (Autoplay)</option>
                    </select>
                </div>
                <div>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>Velocidad</h3>
                    <select 
                        className="system-input" 
                        value={selectedSpeed} 
                        onChange={(e) => setSelectedSpeed(parseFloat(e.target.value))}
                    >
                        <option value={0.5}>Lento (0.5x)</option>
                        <option value={1.0}>Normal (1.0x)</option>
                        <option value={1.5}>Rápido (1.5x)</option>
                    </select>
                </div>
                <div>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>Manos</h3>
                    <select 
                        className="system-input" 
                        value={selectedHands} 
                        onChange={(e) => setSelectedHands(e.target.value)}
                    >
                        <option value="both">Ambas Manos</option>
                        <option value="right">Mano Derecha</option>
                        <option value="left">Mano Izquierda</option>
                    </select>
                </div>
            </div>

            {/* Lista de Canciones */}
            <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {songsData.map((song) => (
                    <div key={song.id} className="system-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem 0' }}>{song.title}</h2>
                            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Artista: {song.artist}</p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                            <span style={{ 
                                background: 'rgba(56, 189, 248, 0.1)', 
                                padding: '4px 8px', 
                                borderRadius: '4px',
                                color: 'var(--accent-primary)'
                            }}>
                                {song.difficulty}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                                {song.octaves} Octavas
                            </span>
                        </div>
                        <button 
                            className="btn-system btn-accent" 
                            style={{ marginTop: 'auto' }}
                            onClick={() => handlePlay(song)}
                        >
                            Tocar ahora 🎹
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SongList;
