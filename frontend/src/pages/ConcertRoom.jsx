import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { InputContext } from '../context/InputContext';
import { KEYBOARD_LAYOUTS, CODE_TO_MIDI, detectLayout } from '../utils/keyboardMap';
import { playNote, stopNote, initAudio, loadInstrument } from '../utils/audioEngine';
import { useMidi } from '../hooks/useMidi';
import { socket } from '../utils/socket';
import { AuthContext } from '../context/AuthContext';

const ConcertRoom = () => {
    const { roomId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { inputMode, keyboardLayout, setKeyboardLayout, selectedMidiDevice, midiRange } = useContext(InputContext);
    const { user } = useContext(AuthContext);

    const layoutMap = KEYBOARD_LAYOUTS[keyboardLayout] || KEYBOARD_LAYOUTS['US'];

    const [roomName] = useState(location.state?.roomName || 'Sala de Concierto');
    const [roomUsers, setRoomUsers] = useState(location.state?.users || []);
    
    // El diccionario de notas de otros usuarios: { socketId: Set() }
    const [remoteNotes, setRemoteNotes] = useState({});
    
    // Mi propio estado de notas
    const [activeNotes, setActiveNotes] = useState(new Set());
    const [instrument, setInstrument] = useState('acoustic_grand_piano'); 
    const [isLoading, setIsLoading] = useState(true);
    const [localVolume, setLocalVolume] = useState(100);
    
    // Volumen de otros usuarios
    const userVolumesRef = useRef({});
    const [userVolumesState, setUserVolumesState] = useState({});

    const pressedKeys = useRef(new Set());
    
    // Refs para evitar "stale closures" en los event listeners del teclado
    const instrumentRef = useRef(instrument);
    const localVolumeRef = useRef(localVolume);

    useEffect(() => {
        instrumentRef.current = instrument;
    }, [instrument]);

    useEffect(() => {
        localVolumeRef.current = localVolume;
    }, [localVolume]);

    const handleVolumeChange = (socketId, value) => {
        userVolumesRef.current[socketId] = value;
        setUserVolumesState(prev => ({ ...prev, [socketId]: value }));
    };

    const getInstrumentIcon = (name) => {
        if (!name) return '🎹';
        const lower = name.toLowerCase();
        if (lower.includes('piano') || lower.includes('clav') || lower.includes('harpsichord')) return '🎹';
        if (lower.includes('guitar') || lower.includes('bass')) return '🎸';
        if (lower.includes('string') || lower.includes('violin') || lower.includes('viola') || lower.includes('cello') || lower.includes('harp') || lower.includes('fiddle') || lower.includes('bowed')) return '🎻';
        if (lower.includes('sax')) return '🎷';
        if (lower.includes('trumpet') || lower.includes('trombone') || lower.includes('tuba') || lower.includes('horn') || lower.includes('brass')) return '🎺';
        if (lower.includes('flute') || lower.includes('oboe') || lower.includes('bassoon') || lower.includes('clarinet') || lower.includes('piccolo') || lower.includes('recorder') || lower.includes('ocarina') || lower.includes('whistle') || lower.includes('shakuhachi') || lower.includes('bottle')) return '🌬️';
        if (lower.includes('organ') || lower.includes('accordion') || lower.includes('harmonica')) return '🪗';
        if (lower.includes('drum') || lower.includes('bell') || lower.includes('vibraphone') || lower.includes('marimba') || lower.includes('xylophone') || lower.includes('timpani') || lower.includes('woodblock') || lower.includes('cymbal') || lower.includes('glockenspiel') || lower.includes('celesta') || lower.includes('agogo') || lower.includes('music_box')) return '🥁';
        if (lower.includes('choir') || lower.includes('voice')) return '🎤';
        if (lower.includes('lead') || lower.includes('pad') || lower.includes('synth')) return '👾';
        return '🎵';
    };

    // Cargar instrumento
    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        
        const load = async () => {
            try {
                await loadInstrument(instrument);
            } catch (e) {
                console.error(e);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        
        load();
        
        const safetyTimeout = setTimeout(() => {
            if (isMounted) setIsLoading(false);
        }, 4000);

        return () => { 
            isMounted = false; 
            clearTimeout(safetyTimeout);
        };
    }, [instrument]);

    // Gestión de Sockets (Otros usuarios)
    useEffect(() => {
        if (!socket.connected) {
            // Si el usuario refresca la página, los sockets se desconectan y se pierde la sala. 
            // Para simplificar, lo devolvemos al lobby.
            navigate('/rooms');
            return;
        }

        const handleUserJoined = (newUser) => {
            if (newUser.instrument) loadInstrument(newUser.instrument);
            setRoomUsers(prev => [...prev, newUser]);
            setRemoteNotes(prev => ({ ...prev, [newUser.socketId]: new Set() }));
        };

        const handleUserLeft = (socketId) => {
            setRoomUsers(prev => prev.filter(u => u.socketId !== socketId));
            setRemoteNotes(prev => {
                const next = { ...prev };
                delete next[socketId];
                return next;
            });
        };

        const handleUserChangedInstrument = ({ socketId, instrument }) => {
            loadInstrument(instrument);
            setRoomUsers(prev => prev.map(u => u.socketId === socketId ? { ...u, instrument } : u));
        };

        const handleRemoteNote = (data) => {
            const { socketId, note, velocity, type, instrument: remoteInstrument } = data;
            
            const targetInstrument = remoteInstrument || 'acoustic_grand_piano';
            const volPercent = userVolumesRef.current[socketId] !== undefined ? userVolumesRef.current[socketId] : 100;
            const adjustedVelocity = (velocity * volPercent) / 100;

            if (type === 'NOTE_ON') {
                if (volPercent > 0) playNote(note, adjustedVelocity, targetInstrument);
                setRemoteNotes(prev => {
                    const userNotes = new Set(prev[socketId] || []);
                    userNotes.add(note);
                    return { ...prev, [socketId]: userNotes };
                });
            } else if (type === 'NOTE_OFF') {
                stopNote(note, targetInstrument);
                setRemoteNotes(prev => {
                    const userNotes = new Set(prev[socketId] || []);
                    userNotes.delete(note);
                    return { ...prev, [socketId]: userNotes };
                });
            }
        };

        socket.on('user_joined', handleUserJoined);
        socket.on('user_left', handleUserLeft);
        socket.on('user_played_note', handleRemoteNote);
        socket.on('user_changed_instrument', handleUserChangedInstrument);

        // Inicializar
        const initialRemoteNotes = {};
        roomUsers.forEach(u => {
            initialRemoteNotes[u.socketId] = new Set();
            if (u.instrument) loadInstrument(u.instrument);
        });
        setRemoteNotes(initialRemoteNotes);

        return () => {
            socket.off('user_joined', handleUserJoined);
            socket.off('user_left', handleUserLeft);
            socket.off('user_played_note', handleRemoteNote);
            socket.off('user_changed_instrument', handleUserChangedInstrument);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const playLocalNote = (midiNote, velocity = 100) => {
        if (pressedKeys.current.has(midiNote)) return;
        pressedKeys.current.add(midiNote);
        const currentInst = instrumentRef.current;
        const currentVol = localVolumeRef.current;
        const adjustedVelocity = (velocity * currentVol) / 100;
        if (currentVol > 0) playNote(midiNote, adjustedVelocity, currentInst);
        setActiveNotes(prev => new Set(prev).add(midiNote));
        socket.emit('play_note', { note: midiNote, velocity, instrument: currentInst });
    };

    const stopLocalNote = (midiNote) => {
        if (!pressedKeys.current.has(midiNote)) return;
        pressedKeys.current.delete(midiNote);
        const currentInst = instrumentRef.current;
        stopNote(midiNote, currentInst);
        setActiveNotes(prev => {
            const next = new Set(prev);
            next.delete(midiNote);
            return next;
        });
        socket.emit('stop_note', { note: midiNote, instrument: currentInst });
    };

    // Mi propio teclado
    useEffect(() => {
        const unlockAudio = () => {
            initAudio();
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);

        if (inputMode === 'keyboard') {
            const handleKeyDown = (e) => {
                const code = e.code;
                const midiNote = CODE_TO_MIDI[code];
                if (midiNote) {
                    playLocalNote(midiNote);
                    const detected = detectLayout(code, e.key);
                    if (detected && detected !== keyboardLayout) setKeyboardLayout(detected);
                }
            };

            const handleKeyUp = (e) => {
                const code = e.code;
                const midiNote = CODE_TO_MIDI[code];
                if (midiNote) stopLocalNote(midiNote);
            };

            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);

            return () => {
                window.removeEventListener('keydown', handleKeyDown);
                window.removeEventListener('keyup', handleKeyUp);
            };
        }
    }, [inputMode, keyboardLayout]);

    useMidi(
        // onNoteOn
        (note, velocity) => {
            playLocalNote(note, velocity);
        },
        // onNoteOff
        (note) => {
            stopLocalNote(note);
        }
    );

    const handleInstrumentChange = (e) => {
        const newInst = e.target.value;
        setInstrument(newInst);
        socket.emit('change_instrument', newInst);
    };

    const renderKeyboard = (noteSet, scale = 1, showLabels = true, interactive = false) => {
        const keys = [];
        const blackKeys = [1, 3, 6, 8, 10]; 

        const startMidi = inputMode === 'midi' ? midiRange[0] : 48;
        const endMidi = inputMode === 'midi' ? midiRange[1] : 84;

        let numWhiteKeys = 0;
        for (let m = startMidi; m <= endMidi; m++) {
            if (!blackKeys.includes(m % 12)) numWhiteKeys++;
        }

        const whiteKeyWidthPercent = 100 / numWhiteKeys;
        let leftOffsetPercent = 0;

        for (let midi = startMidi; midi <= endMidi; midi++) {
            const isBlack = blackKeys.includes(midi % 12);
            const isActive = noteSet?.has(midi);
            const keyLabel = (showLabels && inputMode === 'keyboard') ? (layoutMap[midi]?.toUpperCase() || '') : '';

            const touchHandlers = interactive ? {
                onMouseDown: () => playLocalNote(midi),
                onMouseUp: () => stopLocalNote(midi),
                onMouseLeave: () => { if (isActive) stopLocalNote(midi); },
                onTouchStart: (e) => { e.preventDefault(); playLocalNote(midi); },
                onTouchEnd: (e) => { e.preventDefault(); stopLocalNote(midi); }
            } : {};

            if (isBlack) {
                const blackKeyWidthPercent = whiteKeyWidthPercent * 0.65;
                keys.push(
                    <div key={midi} {...touchHandlers} style={{
                        position: 'absolute', left: `${leftOffsetPercent - (blackKeyWidthPercent / 2)}%`,
                        width: `${blackKeyWidthPercent}%`, height: `${120 * scale}px`,
                        background: isActive ? 'var(--accent-primary)' : '#1e1e1e',
                        border: '1px solid #000', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px',
                        zIndex: 2, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        paddingBottom: `${10 * scale}px`, color: 'white', fontSize: `${0.8 * scale}rem`,
                        fontWeight: 'bold', fontFamily: 'var(--font-mono)'
                    }}>
                        {keyLabel}
                    </div>
                );
            } else {
                keys.push(
                    <div key={midi} {...touchHandlers} style={{
                        position: 'absolute', left: `${leftOffsetPercent}%`,
                        width: `${whiteKeyWidthPercent}%`, height: `${200 * scale}px`,
                        background: isActive ? '#e0f2fe' : '#ffffff',
                        border: '1px solid #ccc', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px',
                        zIndex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        paddingBottom: `${15 * scale}px`, color: '#333', fontSize: `${0.9 * scale}rem`,
                        fontWeight: 'bold', fontFamily: 'var(--font-mono)'
                    }}>
                        {keyLabel}
                    </div>
                );
                leftOffsetPercent += whiteKeyWidthPercent; 
            }
        }
        return keys;
    };

    const mainKeyboard = renderKeyboard(activeNotes, 1, true, true);

    const otherUsers = roomUsers.filter(u => u.id !== user.id);

    return (
        <div style={{ padding: '2rem 5%', maxWidth: '100%', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => {
                    socket.emit('leave_room');
                    navigate('/rooms');
                }} className="btn-system">← Salir de la Sala</button>
                <h2 style={{ margin: 0 }}>Sala: {roomName}</h2>
                <div style={{ padding: '8px 16px', background: 'var(--bg-surface)', borderRadius: '20px', fontSize: '0.9rem' }}>
                    🟢 {roomUsers.length} en línea
                </div>
            </div>

            {/* Fila de otros usuarios (Mini-teclados) */}
            {otherUsers.length > 0 && (
                <div className="system-panel" style={{ display: 'flex', gap: '2rem', overflowX: 'auto', padding: '1rem' }}>
                    {otherUsers.map(u => {
                        const defaultAvatar = `https://ui-avatars.com/api/?name=${u.nombre}&background=3b82f6&color=fff&rounded=true`;
                        const vol = userVolumesState[u.socketId] !== undefined ? userVolumesState[u.socketId] : 100;

                        return (
                            <div key={u.socketId} style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'var(--bg-base)', padding: '12px 16px', borderRadius: '12px' }}>
                                
                                {/* Control de Volumen */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem' }}>{vol > 0 ? '🔊' : '🔇'}</span>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={vol}
                                        onChange={(e) => handleVolumeChange(u.socketId, Number(e.target.value))}
                                        style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '60px', width: '8px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                                        title={`Volumen de ${u.nombre.split(' ')[0]}`}
                                    />
                                </div>

                                {/* Avatar y Teclado */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ position: 'relative' }}>
                                        <img src={u.avatar_url || defaultAvatar} alt={u.nombre} style={{ width: '45px', height: '45px', borderRadius: '50%', marginBottom: '8px', border: '2px solid var(--accent-primary)' }} />
                                        <div style={{ position: 'absolute', bottom: '5px', right: '-12px', fontSize: '1.2rem', background: 'var(--bg-surface)', borderRadius: '50%', padding: '2px 4px', boxShadow: '0 2px 5px rgba(0,0,0,0.4)', zIndex: 2 }} title={u.instrument?.replace(/_/g, ' ') || 'Piano'}>
                                            {getInstrumentIcon(u.instrument)}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 'bold' }}>{u.nombre.split(' ')[0]}</span>
                                    <div style={{ position: 'relative', height: '140px', width: '280px' }}>
                                        {renderKeyboard(remoteNotes[u.socketId], 0.6, false)}
                                    </div>
                                    {u.instrument && (
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '6px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {u.instrument.replace(/_/g, ' ')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Mi Teclado Principal */}
            <div className="system-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-base)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
                    <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
                        Tu Piano
                        {isLoading && <span style={{ fontSize: '1rem', color: '#f59e0b', marginLeft: '10px', fontWeight: 'normal' }}>⏳ Descargando sonido...</span>}
                    </h1>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <select 
                            value={instrument} 
                            onChange={handleInstrumentChange} 
                            className="system-input" 
                            style={{ width: '280px', cursor: 'pointer', background: 'var(--bg-surface)' }}
                            disabled={isLoading}
                        >
                        <optgroup label="🎹 Pianos y Teclados">
                            <option value="acoustic_grand_piano">Piano Acústico de Cola</option>
                            <option value="bright_acoustic_piano">Piano Acústico Brillante</option>
                            <option value="electric_grand_piano">Piano de Cola Eléctrico</option>
                            <option value="honkytonk_piano">Piano Honky-Tonk</option>
                            <option value="electric_piano_1">Piano Eléctrico Clásico</option>
                            <option value="electric_piano_2">Piano Eléctrico (FM)</option>
                            <option value="harpsichord">Clavecín</option>
                            <option value="clavinet">Clavinet</option>
                        </optgroup>
                        
                        <optgroup label="🥁 Batería y Percusión (Drum Kit)">
                            <option value="drum_kit">Batería Completa (Kit)</option>
                        </optgroup>
                        
                        <optgroup label="🔔 Percusión de Tono">
                            <option value="celesta">Celesta</option>
                            <option value="glockenspiel">Glockenspiel</option>
                            <option value="music_box">Caja de Música</option>
                            <option value="vibraphone">Vibráfono</option>
                            <option value="marimba">Marimba</option>
                            <option value="xylophone">Xilófono</option>
                            <option value="tubular_bells">Campanas Tubulares</option>
                            <option value="dulcimer">Dulcémel</option>
                        </optgroup>

                        <optgroup label="⛪ Órganos y Acordeones">
                            <option value="drawbar_organ">Órgano Hammond</option>
                            <option value="percussive_organ">Órgano Percusivo</option>
                            <option value="rock_organ">Órgano Rock</option>
                            <option value="church_organ">Órgano de Iglesia</option>
                            <option value="reed_organ">Órgano de Lengüeta</option>
                            <option value="accordion">Acordeón</option>
                            <option value="harmonica">Armónica</option>
                            <option value="tango_accordion">Bandoneón (Tango)</option>
                        </optgroup>

                        <optgroup label="🎸 Guitarras">
                            <option value="acoustic_guitar_nylon">Guitarra Acústica (Nylon)</option>
                            <option value="acoustic_guitar_steel">Guitarra Acústica (Acero)</option>
                            <option value="electric_guitar_jazz">Guitarra Eléctrica (Jazz)</option>
                            <option value="electric_guitar_clean">Guitarra Eléctrica (Limpia)</option>
                            <option value="electric_guitar_muted">Guitarra Eléctrica (Muted)</option>
                            <option value="overdriven_guitar">Guitarra Overdrive</option>
                            <option value="distortion_guitar">Guitarra Distorsión</option>
                            <option value="guitar_harmonics">Armónicos de Guitarra</option>
                        </optgroup>

                        <optgroup label="🎸 Bajos">
                            <option value="acoustic_bass">Bajo Acústico</option>
                            <option value="electric_bass_finger">Bajo Eléctrico (Dedos)</option>
                            <option value="electric_bass_pick">Bajo Eléctrico (Púa)</option>
                            <option value="fretless_bass">Bajo Fretless</option>
                            <option value="slap_bass_1">Bajo Slap</option>
                            <option value="synth_bass_1">Bajo Sintético 1</option>
                            <option value="synth_bass_2">Bajo Sintético 2</option>
                        </optgroup>

                        <optgroup label="🎻 Cuerdas Frotadas">
                            <option value="violin">Violín</option>
                            <option value="viola">Viola</option>
                            <option value="cello">Violonchelo</option>
                            <option value="contrabass">Contrabajo</option>
                            <option value="tremolo_strings">Cuerdas en Trémolo</option>
                            <option value="pizzicato_strings">Cuerdas en Pizzicato</option>
                            <option value="orchestral_harp">Arpa Orquestal</option>
                            <option value="timpani">Timbales</option>
                            <option value="string_ensemble_1">Ensamblaje de Cuerdas 1</option>
                            <option value="synthstrings_1">Cuerdas Sintéticas</option>
                        </optgroup>

                        <optgroup label="🎺 Metales y Viento">
                            <option value="trumpet">Trompeta</option>
                            <option value="trombone">Trombón</option>
                            <option value="tuba">Tuba</option>
                            <option value="muted_trumpet">Trompeta con Sordina</option>
                            <option value="french_horn">Corno Francés</option>
                            <option value="brass_section">Sección de Metales</option>
                            <option value="synthbrass_1">Metales Sintéticos</option>
                            <option value="soprano_sax">Saxofón Soprano</option>
                            <option value="alto_sax">Saxofón Contralto</option>
                            <option value="tenor_sax">Saxofón Tenor</option>
                            <option value="baritone_sax">Saxofón Barítono</option>
                        </optgroup>

                        <optgroup label="💨 Maderas y Flautas">
                            <option value="oboe">Oboe</option>
                            <option value="english_horn">Corno Inglés</option>
                            <option value="bassoon">Fagot</option>
                            <option value="clarinet">Clarinete</option>
                            <option value="piccolo">Flautín (Piccolo)</option>
                            <option value="flute">Flauta Traversa</option>
                            <option value="recorder">Flauta Dulce</option>
                            <option value="pan_flute">Flauta de Pan</option>
                            <option value="blown_bottle">Botella Soplada</option>
                            <option value="shakuhachi">Shakuhachi</option>
                            <option value="whistle">Silbido</option>
                            <option value="ocarina">Ocarina</option>
                        </optgroup>

                        <optgroup label="🎤 Voces y Coros">
                            <option value="choir_aahs">Coro (Aahs)</option>
                            <option value="voice_oohs">Coro (Oohs)</option>
                            <option value="synth_voice">Voz Sintética</option>
                            <option value="orchestra_hit">Golpe Orquestal</option>
                        </optgroup>

                        <optgroup label="👾 Sintetizadores Lider (Leads)">
                            <option value="lead_1_square">Synth Lead (Square)</option>
                            <option value="lead_2_sawtooth">Synth Lead (Sawtooth)</option>
                            <option value="lead_3_calliope">Synth Lead (Calliope)</option>
                            <option value="lead_4_chiff">Synth Lead (Chiff)</option>
                            <option value="lead_5_charang">Synth Lead (Charang)</option>
                            <option value="lead_6_voice">Synth Lead (Voice)</option>
                            <option value="lead_7_fifths">Synth Lead (Fifths)</option>
                            <option value="lead_8_bass__lead">Synth Lead (Bass+Lead)</option>
                        </optgroup>

                        <optgroup label="🌌 Sintetizadores de Fondo (Pads)">
                            <option value="pad_1_new_age">Synth Pad (New Age)</option>
                            <option value="pad_2_warm">Synth Pad (Warm)</option>
                            <option value="pad_3_polysynth">Synth Pad (Polysynth)</option>
                            <option value="pad_4_choir">Synth Pad (Choir)</option>
                            <option value="pad_5_bowed">Synth Pad (Bowed)</option>
                            <option value="pad_6_metallic">Synth Pad (Metallic)</option>
                            <option value="pad_7_halo">Synth Pad (Halo)</option>
                            <option value="pad_8_sweep">Synth Pad (Sweep)</option>
                        </optgroup>

                        <optgroup label="🌍 Étnicos y Efectos Especiales">
                            <option value="sitar">Sitar (India)</option>
                            <option value="banjo">Banjo</option>
                            <option value="shamisen">Shamisen (Japón)</option>
                            <option value="koto">Koto (Japón)</option>
                            <option value="kalimba">Kalimba</option>
                            <option value="bagpipe">Gaita</option>
                            <option value="fiddle">Violín Tradicional (Fiddle)</option>
                            <option value="shanai">Shehnai</option>
                            <option value="tinkle_bell">Campanita (Tinkle Bell)</option>
                            <option value="agogo">Campana Agogô</option>
                            <option value="steel_drums">Tambores Metálicos (Steel)</option>
                            <option value="woodblock">Caja China</option>
                            <option value="taiko_drum">Tambor Taiko</option>
                            <option value="melodic_tom">Tom Melódico</option>
                            <option value="synth_drum">Tambor Sintético</option>
                            <option value="reverse_cymbal">Platillo en Reversa</option>
                        </optgroup>
                    </select>
                    </div>
                </div>
                
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', textAlign: 'center' }}>
                    Estás transmitiendo a la sala en tiempo real.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', justifyContent: 'center', width: '100%', overflowX: 'auto', paddingBottom: '1rem' }}>
                    {/* Slider Local */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{localVolume > 0 ? '🔊' : '🔇'}</span>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={localVolume}
                            onChange={(e) => setLocalVolume(Number(e.target.value))}
                            style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '160px', width: '12px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                            title="Volumen de Tu Piano"
                        />
                    </div>

                    <div style={{ position: 'relative', height: '220px', width: '100%', minWidth: '800px' }}>
                        {mainKeyboard}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConcertRoom;
