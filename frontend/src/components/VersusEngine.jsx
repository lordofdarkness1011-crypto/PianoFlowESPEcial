import React, { useEffect, useRef, useState } from 'react';
import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';

const LANE_KEYS = ['d', 'f', 'j', 'k'];
const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#eab308'];

const VersusEngine = ({ socket, roomState, song, user, opponent, isHost }) => {
    const canvasRef = useRef(null);
    const requestRef = useRef();
    
    const [myStats, setMyStats] = useState({ score: 0, combo: 0, hits: 0, misses: 0, maxCombo: 0 });
    const [oppStats, setOppStats] = useState({ score: 0, combo: 0, hits: 0, misses: 0 });
    const [gameOver, setGameOver] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [isLoaded, setIsLoaded] = useState(false);
    
    // Stats for rendering in the loop without closure issues
    const myStatsRef = useRef({ score: 0, combo: 0, hits: 0, misses: 0, maxCombo: 0 });
    const oppStatsRef = useRef({ score: 0, combo: 0, hits: 0, misses: 0 });
    
    const gameState = useRef({
        startTime: 0,
        currentTime: -3.0,
        notes: [],
        activeKeys: [false, false, false, false],
        isLoaded: false
    });

    const synthRef = useRef(null);
    const lastSocketUpdate = useRef(0);

    // Inicializar Sintetizador
    useEffect(() => {
        const synth = new Tone.PolySynth(Tone.Synth).toDestination();
        synth.volume.value = -5; // Bajar un poco el volumen
        synthRef.current = synth;
        
        return () => {
            synth.dispose();
        };
    }, []);

    // Cargar MIDI y preparar notas
    useEffect(() => {
        let isMounted = true;
        const loadMidi = async () => {
            try {
                const response = await fetch(song.file);
                const arrayBuffer = await response.arrayBuffer();
                const midi = new Midi(arrayBuffer);
                
                let allNotes = [];
                midi.tracks.forEach(track => {
                    track.notes.forEach(note => {
                        allNotes.push({
                            lane: note.midi % 4,
                            time: note.time,
                            duration: note.duration,
                            name: note.name, // Necesario para Tone.js
                            hit: false,
                            missed: false,
                            y: -100 // posición inicial fuera de pantalla
                        });
                    });
                });

                allNotes.sort((a, b) => a.time - b.time);
                
                if (isMounted) {
                    gameState.current.notes = allNotes;
                    gameState.current.isLoaded = true;
                    gameState.current.startTime = performance.now();
                    setIsLoaded(true);
                }
            } catch (err) {
                console.error("Error cargando MIDI:", err);
            }
        };
        loadMidi();
        return () => { isMounted = false; };
    }, [song]);

    // Socket listeners para el oponente
    useEffect(() => {
        const handleOpponentScore = (data) => {
            if (data.userId === opponent?.id) {
                const newOppStats = {
                    score: data.score,
                    combo: data.combo,
                    hits: data.hits,
                    misses: data.misses
                };
                oppStatsRef.current = newOppStats;
                setOppStats(newOppStats); // Keep for Game Over screen
            }
        };

        socket.on('versus_opponent_score', handleOpponentScore);
        
        return () => {
            socket.off('versus_opponent_score', handleOpponentScore);
        };
    }, [socket, opponent]);

    // Input del teclado
    useEffect(() => {
        const handleKeyDown = async (e) => {
            if (gameOver) return;
            
            // Iniciar AudioContext en la primera interacción del usuario
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }

            const keyIndex = LANE_KEYS.indexOf(e.key.toLowerCase());
            if (keyIndex !== -1 && !gameState.current.activeKeys[keyIndex]) {
                gameState.current.activeKeys[keyIndex] = true;
                checkHit(keyIndex);
            }
        };
        
        const handleKeyUp = (e) => {
            const keyIndex = LANE_KEYS.indexOf(e.key.toLowerCase());
            if (keyIndex !== -1) {
                gameState.current.activeKeys[keyIndex] = false;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameOver]);

    const checkHit = (laneIndex) => {
        const state = gameState.current;
        if (state.currentTime < 0) return;

        const hitWindow = 0.20; // 200ms (Aumentado para mejor jugabilidad)

        for (let i = 0; i < state.notes.length; i++) {
            const note = state.notes[i];
            if (note.lane === laneIndex && !note.hit && !note.missed) {
                if (Math.abs(note.time - state.currentTime) < hitWindow) {
                    note.hit = true;
                    
                    // Reproducir sonido de la nota de forma asíncrona sin bloquear el hilo
                    if (synthRef.current && Tone.context.state === 'running') {
                        try {
                            synthRef.current.triggerAttackRelease(note.name, "8n", Tone.now());
                        } catch (e) {}
                    }
                    
                    const prev = myStatsRef.current;
                    const newCombo = prev.combo + 1;
                    const newScore = prev.score + (100 + (newCombo * 10));
                    
                    const newStats = {
                        ...prev,
                        hits: prev.hits + 1,
                        combo: newCombo,
                        maxCombo: Math.max(prev.maxCombo, newCombo),
                        score: newScore
                    };
                    
                    myStatsRef.current = newStats;
                    setMyStats(newStats); // update react state for game over screen
                    break;
                }
            }
        }
    };

    // Game Loop
    useEffect(() => {
        if (!gameState.current.isLoaded) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const HIT_Y = canvas.height - 100;
        const NOTE_SPEED = 400; // píxeles por segundo

        const update = () => {
            if (gameOver) return;
            
            const now = performance.now();
            const elapsed = (now - gameState.current.startTime) / 1000;
            gameState.current.currentTime = elapsed - 3.0; // 3 segundos de gracia
            const currentTime = gameState.current.currentTime;

            if (currentTime < 0) {
                setCountdown(Math.ceil(-currentTime));
            } else if (countdown !== null) {
                setCountdown(null);
            }

            // Actualizar notas y chequear Misses
            let activeNotesLeft = 0;
            gameState.current.notes.forEach(note => {
                // Calcular posición Y siempre para que sigan cayendo en el tablero del oponente
                const timeDiff = note.time - currentTime;
                note.y = HIT_Y - (timeDiff * NOTE_SPEED);

                if (!note.hit && !note.missed) {
                    activeNotesLeft++;

                    // Si se pasó la zona de hit
                    if (timeDiff < -0.2) {
                        note.missed = true;
                        
                        const newStats = {
                            ...myStatsRef.current,
                            misses: myStatsRef.current.misses + 1,
                            combo: 0
                        };
                        
                        myStatsRef.current = newStats;
                        setMyStats(newStats);
                    }
                }
            });

            // Si se acabaron las notas
            if (currentTime > 0 && activeNotesLeft === 0) {
                setTimeout(() => {
                    setGameOver(true);
                    socket.emit('versus_finish_game');
                }, 2000);
            }

            // Dibujar
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Dibujar Fondo Split Screen con separación
            const canvasWidth = canvas.width;
            const midX = canvasWidth / 2;
            const gap = 100; // Aumentar el gap para que sea súper evidente
            const boardWidth = (canvasWidth / 2) - gap;
            
            // Lado Izquierdo (Jugador)
            drawLane(ctx, gap/2, (gap/2) + boardWidth, 'Tú', myStatsRef.current, gameState.current.notes, gameState.current.activeKeys, true);
            
            // Lado Derecho (Oponente)
            drawLane(ctx, midX + (gap/2), midX + (gap/2) + boardWidth, opponent ? opponent.nombre : 'Desconectado', oppStatsRef.current, gameState.current.notes, [false,false,false,false], false);

            // Barra Tira y Afloja
            drawTugOfWar(ctx, myStatsRef.current.score, oppStatsRef.current.score, canvas.width);

            // Emitir socket update cada 500ms
            if (now - lastSocketUpdate.current > 500) {
                socket.emit('versus_score_update', myStatsRef.current);
                lastSocketUpdate.current = now;
            }

            requestRef.current = requestAnimationFrame(update);
        };

        requestRef.current = requestAnimationFrame(update);
        return () => cancelAnimationFrame(requestRef.current);
    }, [isLoaded, gameOver, opponent, socket]);

    const drawLane = (ctx, startX, endX, name, stats, notes, activeKeys, isLocal) => {
        const width = endX - startX;
        const colWidth = width / 4;
        const HIT_Y = canvasRef.current.height - 100;

        // Fondo oscuro
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(startX, 0, width, canvasRef.current.height);

        // Borde del tablero
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, 0, width, canvasRef.current.height);

        // Stats Overlay
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(startX, 0, width, 80);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '20px Arial';
        ctx.textAlign = isLocal ? 'left' : 'right';
        const textX = isLocal ? startX + 20 : endX - 20;
        ctx.fillText(name, textX, 30);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`Score: ${stats.score} | Combo: ${stats.combo}x`, textX, 60);

        // Carriles
        for (let i = 0; i < 4; i++) {
            const cx = startX + (i * colWidth);
            
            // Líneas de carril
            ctx.strokeStyle = '#1e293b';
            ctx.beginPath();
            ctx.moveTo(cx, 0);
            ctx.lineTo(cx, canvasRef.current.height);
            ctx.stroke();

            // Hit zone receptor
            ctx.fillStyle = activeKeys[i] ? COLORS[i] : '#1e293b';
            ctx.globalAlpha = activeKeys[i] ? 0.8 : 0.3;
            ctx.fillRect(cx, HIT_Y - 10, colWidth, 20);
            ctx.globalAlpha = 1.0;
            
            if (isLocal) {
                // Letra de la tecla
                ctx.fillStyle = '#ffffff';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(LANE_KEYS[i].toUpperCase(), cx + colWidth/2, HIT_Y + 30);
            }
        }

        // Dibujamos las notas en ambos tableros
        notes.forEach(note => {
            // Para el jugador local, ocultamos las hits. Para el oponente, dejamos que caigan para efecto visual
            if (!note.missed && note.y > 0 && note.y < canvasRef.current.height) {
                if (isLocal && note.hit) return; // Si es el nuestro y la golpeamos, desaparece.
                
                const nx = startX + (note.lane * colWidth);
                ctx.fillStyle = COLORS[note.lane];
                // Redondear bordes
                ctx.beginPath();
                ctx.roundRect(nx + 5, note.y - 15, colWidth - 10, 30, 5);
                ctx.fill();
            }
        });
    };

    const drawTugOfWar = (ctx, myScore, oppScore, totalWidth) => {
        const height = 10;
        
        let ratio = 0.5; // Empate
        if (myScore + oppScore > 0) {
            ratio = myScore / (myScore + oppScore);
        }

        // Oponente (Rojo) fondo
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(0, 0, totalWidth, height);

        // Jugador (Azul) frente
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(0, 0, totalWidth * ratio, height);

        // Marcador central
        ctx.fillStyle = '#ffffff';
        ctx.fillRect((totalWidth * ratio) - 2, 0, 4, height + 5);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#020617', padding: '1rem', height: '100vh', position: 'relative' }}>
            
            {/* Botón de Retroceso en Juego */}
            <button 
                onClick={() => socket.emit('versus_back_to_lobby')}
                style={{ 
                    position: 'absolute', 
                    top: '20px', 
                    left: '20px', 
                    background: 'rgba(239, 68, 68, 0.2)', 
                    color: '#ef4444', 
                    border: '1px solid #ef4444',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    zIndex: 50,
                    fontWeight: 'bold'
                }}
            >
                ← Abandonar Partida
            </button>

            {countdown !== null && !gameOver && (
                <div style={{ position: 'absolute', top: '40%', fontSize: '5rem', color: 'white', textShadow: '0 0 20px #3b82f6', zIndex: 10 }}>
                    {countdown > 0 ? countdown : '¡YA!'}
                </div>
            )}

            {gameOver && (
                <div style={{ position: 'absolute', top: '30%', background: 'rgba(15, 23, 42, 0.95)', padding: '3rem', borderRadius: '15px', border: '2px solid #3b82f6', zIndex: 20, textAlign: 'center', boxShadow: '0 0 50px rgba(59, 130, 246, 0.5)' }}>
                    <h2 style={{ fontSize: '3rem', color: 'white', marginBottom: '1rem' }}>
                        {myStats.score > oppStats.score ? '¡VICTORIA! 🏆' : myStats.score < oppStats.score ? 'DERROTA 💀' : 'EMPATE 🤝'}
                    </h2>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '2rem' }}>
                        <div>
                            <h3 style={{ color: '#3b82f6' }}>Tú</h3>
                            <p style={{ color: '#e2e8f0', fontSize: '1.2rem' }}>Score: {myStats.score}</p>
                            <p style={{ color: '#94a3b8' }}>Max Combo: {myStats.maxCombo}x</p>
                            <p style={{ color: '#10b981' }}>Hits: {myStats.hits}</p>
                            <p style={{ color: '#ef4444' }}>Misses: {myStats.misses}</p>
                        </div>
                        <div>
                            <h3 style={{ color: '#ef4444' }}>{opponent ? opponent.nombre : 'Oponente'}</h3>
                            <p style={{ color: '#e2e8f0', fontSize: '1.2rem' }}>Score: {oppStats.score}</p>
                            <p style={{ color: '#94a3b8' }}>Combo Final: {oppStats.combo}x</p>
                            <p style={{ color: '#10b981' }}>Hits: {oppStats.hits}</p>
                            <p style={{ color: '#ef4444' }}>Misses: {oppStats.misses}</p>
                        </div>
                    </div>

                    {isHost && (
                        <button 
                            className="btn-system"
                            onClick={() => socket.emit('versus_back_to_lobby')}
                        >
                            Volver a la Sala
                        </button>
                    )}
                    {!isHost && <p style={{ color: '#94a3b8' }}>Esperando al anfitrión...</p>}
                </div>
            )}

            <canvas 
                ref={canvasRef} 
                width={800} 
                height={600} 
                style={{ 
                    border: '2px solid #1e293b', 
                    borderRadius: '8px', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    background: 'transparent'
                }}
            />
            
            <div style={{ marginTop: '1rem', color: '#94a3b8' }}>
                Usa las teclas <strong>D, F, J, K</strong> para tocar las notas.
            </div>
        </div>
    );
};

export default VersusEngine;
