import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import GameEngine from '../components/GameEngine';
import { initAudio, loadInstrument } from '../utils/audioEngine';

const Gameplay = () => {
    const { songId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    // Si entran directo a la URL sin pasar por SongList, redirigimos
    const song = location.state?.song;
    const config = location.state?.config;

    const [countdown, setCountdown] = useState(3);
    const [isPaused, setIsPaused] = useState(false);
    const [gameState, setGameState] = useState('countdown'); // 'countdown', 'playing', 'paused', 'finished'
    const [stats, setStats] = useState(null);

    // Configuración mutable para permitir cambiar velocidad desde la pausa
    const [currentSpeed, setCurrentSpeed] = useState(config?.speed || 1.0);

    useEffect(() => {
        if (!song || !config) {
            navigate('/dashboard/songs');
            return;
        }

        // Cargar el instrumento para el Autoplay
        initAudio();
        loadInstrument('acoustic_grand_piano');

        // Manejador de la tecla Escape para pausar
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (gameState === 'playing') {
                    setGameState('paused');
                    setIsPaused(true);
                } else if (gameState === 'paused') {
                    resumeGame();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, song, config, navigate]);

    // Lógica de la cuenta regresiva
    useEffect(() => {
        if (gameState === 'countdown') {
            if (countdown > 0) {
                const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
                return () => clearTimeout(timer);
            } else {
                setGameState('playing');
            }
        }
    }, [countdown, gameState]);

    const resumeGame = () => {
        // Pequeño delay para acomodar las manos
        setCountdown(1); 
        setGameState('countdown');
        setIsPaused(false);
    };

    const handleFinish = (finalStats) => {
        setStats(finalStats);
        setGameState('finished');
        if (config.mode === 'listening') {
            navigate('/dashboard/songs'); // En Listening, solo regresamos al menú
        } else {
            navigate(`/results`, { state: { stats: finalStats, song, config: { ...config, speed: currentSpeed } } });
        }
    };

    if (!song) return null;

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: 'var(--bg-base)', overflow: 'hidden' }}>
            
            {/* Header del juego */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '1rem', display: 'flex', justifyContent: 'space-between', zIndex: 10, color: 'var(--text-main)' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{song.title}</h2>
                    <span style={{ fontSize: '0.9rem', color: '#ccc' }}>Modo: {config.mode === 'wait' ? 'Espera' : config.mode === 'listening' ? 'Listening' : 'Normal'} | Vel: {currentSpeed}x</span>
                </div>
                <div>
                    <button className="btn-system" onClick={() => setGameState('paused')} style={{ background: 'rgba(255,255,255,0.2)', padding: '5px 15px' }}>
                        Pausa (Esc)
                    </button>
                </div>
            </div>

            {/* El Motor Gráfico */}
            <GameEngine 
                song={song} 
                config={{ ...config, speed: currentSpeed }} 
                isPlaying={gameState !== 'paused' && gameState !== 'finished'}
                countdown={gameState === 'countdown' ? countdown : 0}
                onFinish={handleFinish}
            />

            {/* Overlay de Cuenta Regresiva (Texto flotante) */}
            {gameState === 'countdown' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }}>
                    <h1 style={{ fontSize: '8rem', color: 'var(--accent-primary)', margin: 0, textShadow: '0 0 20px var(--accent-primary)' }}>
                        {countdown}
                    </h1>
                </div>
            )}

            {/* Overlay de Pausa */}
            {gameState === 'paused' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 30 }}>
                    <div className="system-panel" style={{ width: '400px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Pausa</h2>
                        
                        <button className="btn-system btn-accent" onClick={resumeGame}>Continuar</button>
                        
                        <button className="btn-system" onClick={() => {
                            // Cambiar velocidad en caliente
                            const speeds = [0.5, 1.0, 1.5];
                            const nextIndex = (speeds.indexOf(currentSpeed) + 1) % speeds.length;
                            setCurrentSpeed(speeds[nextIndex]);
                        }}>
                            Velocidad: {currentSpeed}x
                        </button>

                        <button className="btn-system" onClick={() => window.location.reload()} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                            Reiniciar Canción
                        </button>
                        
                        <button className="btn-system" onClick={() => navigate('/dashboard/songs')} style={{ marginTop: '1rem' }}>
                            Salir
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gameplay;
