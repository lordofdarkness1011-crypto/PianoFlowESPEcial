import React, { useEffect, useRef, useState, useContext } from 'react';
import { Midi } from '@tonejs/midi';
import { useMidi } from '../hooks/useMidi';
import { InputContext } from '../context/InputContext';
import { playNote, stopNote } from '../utils/audioEngine';

/**
 * Motor Gráfico HTML5 Canvas
 */
const GameEngine = ({ song, config, isPlaying, countdown, onFinish }) => {
    const canvasRef = useRef(null);
    const requestRef = useRef();
    const { inputMode, midiRange } = useContext(InputContext);
    
    // Estado interno del juego
    const stateRef = useRef({
        currentTime: -3.0, // Arranca 3 segundos antes para sincronizar la caída
        lastTime: performance.now(),
        notes: [],
        activeNotes: new Set(),
        pressedKeys: new Set(),
        staleKeys: new Set(), // Teclas que ya estaban presionadas antes de llegar a un acorde (previene hold-exploit)
        ghostKeys: new Set(), // Teclas tocadas por el Autoplay
        stats: { hits: 0, misses: 0, maxCombo: 0, currentCombo: 0, totalNotes: 0 },
        isLoaded: false
    });

    // Cargar y parsear el MIDI
    useEffect(() => {
        let isMounted = true;
        const loadMidi = async () => {
            try {
                const response = await fetch(song.file);
                const arrayBuffer = await response.arrayBuffer();
                const midi = new Midi(arrayBuffer);
                
                let allNotes = [];
                midi.tracks.forEach((track, index) => {
                    if (config.hands === 'right' && index !== 0) return;
                    if (config.hands === 'left' && index !== 1) return;

                    track.notes.forEach(note => {
                        allNotes.push({
                            midi: note.midi,
                            name: note.name,
                            time: note.time,
                            duration: note.duration,
                            hit: false,
                            missed: false
                        });
                    });
                });

                allNotes.sort((a, b) => a.time - b.time);
                
                if (isMounted) {
                    stateRef.current.notes = allNotes;
                    stateRef.current.stats.totalNotes = allNotes.length;
                    stateRef.current.isLoaded = true;
                }
            } catch (err) {
                console.error("Error cargando MIDI:", err);
            }
        };
        loadMidi();
        return () => { isMounted = false; };
    }, [song, config.hands]);

    // Lógica del hardware (Midi)
    const handleNoteOn = (noteNum, velocity) => {
        const state = stateRef.current;
        state.pressedKeys.add(noteNum);
        
        // El NoteOn fue fresco, si estaba en staleKeys lo removemos por si acaso (aunque debería haberse ido en noteOff)
        state.staleKeys.delete(noteNum);
        
        // Reproducir el sonido localmente
        playNote(noteNum, velocity || 80, 'acoustic_grand_piano');
        
        const currentTime = state.currentTime;
        if (currentTime < 0) return; // No calificar durante la cuenta regresiva

        // En MODO NORMAL: calificar al instante si le atinó
        if (config.mode === 'normal' && isPlaying) {
            const hitWindow = 0.15; // 150ms ventana estricta
            
            // Buscar la nota más próxima en el tiempo (que no haya sido tocada)
            for (let i = 0; i < state.notes.length; i++) {
                const note = state.notes[i];
                if (note.midi === noteNum && !note.hit && !note.missed) {
                    if (Math.abs(note.time - currentTime) < hitWindow) {
                        note.hit = true;
                        state.stats.hits += 1;
                        state.stats.currentCombo += 1;
                        if (state.stats.currentCombo > state.stats.maxCombo) {
                            state.stats.maxCombo = state.stats.currentCombo;
                        }
                        break; // Solo marcamos un hit por cada pulsación
                    }
                }
            }
        }
        // En MODO ESPERA: no hacemos nada aquí. La validación se hace en el game loop para exigir que todo el acorde se toque junto.
    };

    const handleNoteOff = (noteNum) => {
        const state = stateRef.current;
        state.pressedKeys.delete(noteNum);
        state.staleKeys.delete(noteNum); // Al soltar la tecla, se vuelve a habilitar para el próximo acorde
        
        // Detener el sonido local
        stopNote(noteNum, 'acoustic_grand_piano');
    };

    useMidi(handleNoteOn, handleNoteOff, null, null);

    // Motor de Renderizado y Bucle de Juego
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const keyboardHeight = 160;
        const keyboardY = canvas.height - keyboardHeight;
        
        // SINCRONIZACIÓN DE HARDWARE ESTRICTA
        // El Canvas mostrará exactamente las octavas configuradas por el usuario en InputContext
        const startMidi = midiRange[0];
        const endMidi = midiRange[1];

        // Cálculos del Teclado
        const blackKeysRel = [1, 3, 6, 8, 10];
        let numWhiteKeys = 0;
        for (let m = startMidi; m <= endMidi; m++) {
            if (!blackKeysRel.includes(m % 12)) numWhiteKeys++;
        }
        
        const whiteKeyWidth = canvas.width / numWhiteKeys;
        
        // Mapear cada nota MIDI a su posición y ancho en X
        const keyPositions = {};
        let currentX = 0;
        for (let m = startMidi; m <= endMidi; m++) {
            const isBlack = blackKeysRel.includes(m % 12);
            if (!isBlack) {
                keyPositions[m] = { x: currentX, w: whiteKeyWidth, type: 'white' };
                currentX += whiteKeyWidth;
            }
        }
        // Superponer negras
        currentX = 0;
        for (let m = startMidi; m <= endMidi; m++) {
            const isBlack = blackKeysRel.includes(m % 12);
            if (isBlack) {
                const blackKeyWidth = whiteKeyWidth * 0.65;
                // La negra se centra entre la blanca anterior y la siguiente
                keyPositions[m] = { x: currentX - (blackKeyWidth / 2), w: blackKeyWidth, type: 'black' };
            } else {
                currentX += whiteKeyWidth;
            }
        }

        // Bucle principal (Game Loop) a 60 FPS
        const loop = (timestamp) => {
            const state = stateRef.current;
            if (!state.isLoaded) {
                requestRef.current = requestAnimationFrame(loop);
                return;
            }

            const deltaTime = (timestamp - state.lastTime) / 1000;
            state.lastTime = timestamp;

            if (isPlaying) {
                if (state.currentTime < 0) {
                    // Durante cuenta regresiva, el tiempo avanza normalmente
                    state.currentTime += deltaTime;
                    if (state.currentTime > 0 && countdown > 0) {
                        state.currentTime = 0; 
                    }
                } else if (config.mode === 'listening') {
                    // MODO LISTENING (Autoplay)
                    state.currentTime += deltaTime * config.speed;
                } else if (config.mode === 'normal') {
                    state.currentTime += deltaTime * config.speed;
                } else if (config.mode === 'wait') {
                    // LÓGICA DE ACORDES ESTRICTA
                    const nextNotes = [];
                    const timeThreshold = 0.05; // 50ms de tolerancia para agrupar notas de un acorde
                    let firstNoteTime = -1;

                    // Buscar el siguiente grupo inmediato de notas a tocar
                    for (let note of state.notes) {
                        if (!note.hit && !note.missed) {
                            if (firstNoteTime === -1) firstNoteTime = note.time;
                            if (Math.abs(note.time - firstNoteTime) < timeThreshold) {
                                nextNotes.push(note);
                            } else {
                                break;
                            }
                        }
                    }

                    if (nextNotes.length > 0) {
                        const targetTime = nextNotes[0].time;
                        if (state.currentTime >= targetTime) {
                            state.currentTime = targetTime; // Pausar el tiempo
                            
                            // Evaluar si TODAS las teclas del acorde están presionadas de forma fresca
                            const allPressed = nextNotes.every(n => 
                                state.pressedKeys.has(n.midi) && !state.staleKeys.has(n.midi)
                            );
                            
                            if (allPressed) {
                                // Acierto de Acorde Completo
                                nextNotes.forEach(n => {
                                    n.hit = true;
                                    state.stats.hits += 1;
                                });
                                state.stats.currentCombo += nextNotes.length;
                                if (state.stats.currentCombo > state.stats.maxCombo) {
                                    state.stats.maxCombo = state.stats.currentCombo;
                                }
                                
                                // Registrar las teclas actuales como "viejas" para el próximo acorde
                                state.staleKeys = new Set(state.pressedKeys);
                                
                                // Un pequeño empujón al tiempo para desatascar el loop
                                state.currentTime += 0.01;
                            }
                        } else {
                            state.currentTime += deltaTime * config.speed;
                        }
                    } else {
                        state.currentTime += deltaTime * config.speed;
                    }
                }
            }

            // LIMPIAR CANVAS
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // DIBUJAR CARRILES (Lanes)
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            for (let m = startMidi; m <= endMidi; m++) {
                if (keyPositions[m] && keyPositions[m].type === 'white') {
                    ctx.moveTo(keyPositions[m].x, 0);
                    ctx.lineTo(keyPositions[m].x, keyboardY);
                }
            }
            ctx.stroke();

            // Velocidad dinámica: tarda exactamente 3 segundos en caer
            const PIXELS_PER_SECOND = (keyboardY / 3) * config.speed;
            
            let allFinished = true;

            // DIBUJAR NOTAS
            state.notes.forEach(note => {
                const timeDiff = note.time - state.currentTime;
                
                // MODO LISTENING: Autoplay disparador
                if (config.mode === 'listening') {
                    if (timeDiff <= 0 && !note.audioPlayed) {
                        note.audioPlayed = true;
                        playNote(note.midi, 80, 'acoustic_grand_piano');
                        state.ghostKeys.add(note.midi);
                        note.hit = true; // Efecto visual
                    }
                    if (timeDiff <= -note.duration && !note.audioStopped) {
                        note.audioStopped = true;
                        stopNote(note.midi, 'acoustic_grand_piano');
                        state.ghostKeys.delete(note.midi);
                    }
                }

                // Si la nota pasó la zona de hit en modo Normal sin tocarse
                if (timeDiff < -0.15 && !note.hit && !note.missed && config.mode === 'normal') {
                    note.missed = true;
                    state.stats.misses += 1;
                    state.stats.currentCombo = 0;
                }

                // Renderizamos la nota hasta que su COLA haya cruzado completamente la línea (-note.duration)
                if (timeDiff > -(note.duration + 0.5) && timeDiff < 10) { 
                    allFinished = false;

                    const noteY = keyboardY - (timeDiff * PIXELS_PER_SECOND);
                    const noteHeight = Math.max((note.duration * PIXELS_PER_SECOND), 15);
                    
                    const pos = keyPositions[note.midi];
                    if (pos) {
                        // Visual de Estado (Missed, Hit sostenido, Hit soltado temprano)
                        let fillStyle = pos.type === 'black' ? '#0ea5e9' : '#38bdf8'; // Normal
                        let isGlowing = false;

                        if (note.missed) {
                            fillStyle = 'rgba(239, 68, 68, 0.5)'; // Rojo fallo
                        } else if (note.hit) {
                            if (config.mode === 'listening' && state.ghostKeys.has(note.midi)) {
                                fillStyle = '#86efac'; // Verde menta brillante si el fantasma la mantiene presionada
                                isGlowing = true;
                            } else if (state.pressedKeys.has(note.midi)) {
                                fillStyle = '#ffffff'; // Blanca brillante si el humano la mantiene presionada
                                isGlowing = true;
                            } else {
                                fillStyle = 'rgba(56, 189, 248, 0.4)'; // Semitransparente si la soltó
                            }
                        }
                        
                        ctx.fillStyle = fillStyle;
                        
                        // Dibujar cuerpo de la nota
                        ctx.beginPath();
                        ctx.roundRect(pos.x + 2, noteY - noteHeight, pos.w - 4, noteHeight, 5);
                        ctx.fill();
                        
                        // Brillo superior
                        if (!note.missed && !isGlowing) {
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                            ctx.beginPath();
                            ctx.roundRect(pos.x + 2, noteY - noteHeight, pos.w - 4, 10, 5);
                            ctx.fill();
                        }
                        
                        // Efecto de aura brillante si está activa y sostenida
                        if (isGlowing && noteY >= keyboardY && (noteY - noteHeight) <= keyboardY) {
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = config.mode === 'listening' ? '#86efac' : '#0ea5e9';
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(pos.x, keyboardY - 5, pos.w, 10);
                            ctx.shadowBlur = 0; // reset
                        }
                    }
                } else if (timeDiff >= 10) {
                    allFinished = false;
                }
            });

            if (allFinished && state.isLoaded && state.currentTime > 1) {
                onFinish(state.stats);
                return;
            }

            // DIBUJAR TECLADO
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, keyboardY, canvas.width, keyboardHeight);

            // 1. Teclas Blancas
            for (let m = startMidi; m <= endMidi; m++) {
                const pos = keyPositions[m];
                if (pos && pos.type === 'white') {
                    const isPressed = state.pressedKeys.has(m);
                    const isGhost = config.mode === 'listening' && state.ghostKeys.has(m);
                    
                    ctx.fillStyle = isPressed ? '#e0f2fe' : isGhost ? '#dcfce7' : '#ffffff';
                    ctx.fillRect(pos.x, keyboardY, pos.w, keyboardHeight);
                    
                    ctx.strokeStyle = '#cccccc';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(pos.x, keyboardY, pos.w, keyboardHeight);

                    if (isPressed) {
                        ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
                        ctx.fillRect(pos.x, keyboardY + keyboardHeight - 20, pos.w, 20);
                    } else if (isGhost) {
                        ctx.fillStyle = 'rgba(74, 222, 128, 0.3)';
                        ctx.fillRect(pos.x, keyboardY + keyboardHeight - 20, pos.w, 20);
                    }
                }
            }

            // 2. Teclas Negras
            for (let m = startMidi; m <= endMidi; m++) {
                const pos = keyPositions[m];
                if (pos && pos.type === 'black') {
                    const isPressed = state.pressedKeys.has(m);
                    const isGhost = config.mode === 'listening' && state.ghostKeys.has(m);
                    
                    ctx.fillStyle = isPressed ? 'var(--accent-primary, #38bdf8)' : isGhost ? '#4ade80' : '#1e1e1e';
                    const blackHeight = keyboardHeight * 0.6;
                    
                    ctx.beginPath();
                    ctx.roundRect(pos.x, keyboardY, pos.w, blackHeight, [0, 0, 4, 4]);
                    ctx.fill();
                    
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    if (!isPressed && !isGhost) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                        ctx.fillRect(pos.x + 2, keyboardY, pos.w - 4, blackHeight - 10);
                    }
                }
            }
            
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(0, keyboardY - 3, canvas.width, 3);

            // HUD
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText(`Combo: ${state.stats.currentCombo}`, 30, 80);
            ctx.fillText(`Precisión: ${state.stats.totalNotes > 0 ? Math.round((state.stats.hits / state.stats.totalNotes) * 100) : 0}%`, 30, 110);
            
            if (state.currentTime < 0) {
                const progress = Math.max(0, 3 + state.currentTime) / 3;
                ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
                ctx.fillRect(0, keyboardY - 10, canvas.width * progress, 5);
            }

            requestRef.current = requestAnimationFrame(loop);
        };

        requestRef.current = requestAnimationFrame(loop);
        
        return () => {
            cancelAnimationFrame(requestRef.current);
        };
    }, [isPlaying, config, song, countdown, onFinish, inputMode, midiRange]);

    return (
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', backgroundColor: 'transparent' }} />
    );
};

export default GameEngine;
