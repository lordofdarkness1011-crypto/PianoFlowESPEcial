import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { InputContext } from '../context/InputContext';
import { KEYBOARD_LAYOUTS, CODE_TO_MIDI, detectLayout } from '../utils/keyboardMap';
import { playNote, stopNote, initAudio, loadInstrument } from '../utils/audioEngine';
import { useMidi } from '../hooks/useMidi';

const FreePlay = () => {
    const navigate = useNavigate();
    const { inputMode, keyboardLayout, setKeyboardLayout, midiRange } = useContext(InputContext);
    const [activeNotes, setActiveNotes] = useState(new Set());
    const [instrument, setInstrument] = useState('acoustic_grand_piano'); 
    const [isLoading, setIsLoading] = useState(true);

    const layoutMap = KEYBOARD_LAYOUTS[keyboardLayout] || KEYBOARD_LAYOUTS['US'];

    // Evitar disparos repetidos por sostener la tecla
    const pressedKeys = useRef(new Set());
    const instrumentRef = useRef(instrument);

    useEffect(() => {
        instrumentRef.current = instrument;
    }, [instrument]);

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
        
        // Timeout de seguridad de 4 segundos
        const safetyTimeout = setTimeout(() => {
            if (isMounted) setIsLoading(false);
        }, 4000);

        return () => { 
            isMounted = false; 
            clearTimeout(safetyTimeout);
        };
    }, [instrument]);

    useEffect(() => {
        // Desbloquear AudioContext al primer click o pulsación
        const unlockAudio = () => {
            initAudio();
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('keydown', unlockAudio);

        if (inputMode === 'keyboard') {
            const handleKeyDown = (e) => {
                const code = e.code;
                if (pressedKeys.current.has(code)) return;
                
                const midiNote = CODE_TO_MIDI[code];
                if (midiNote) {
                    pressedKeys.current.add(code);
                    playNote(midiNote, 100, instrumentRef.current);
                    setActiveNotes(prev => new Set(prev).add(midiNote));
                    
                    const detected = detectLayout(code, e.key);
                    if (detected && detected !== keyboardLayout) setKeyboardLayout(detected);
                }
            };

            const handleKeyUp = (e) => {
                const code = e.code;
                const midiNote = CODE_TO_MIDI[code];
                if (midiNote) {
                    pressedKeys.current.delete(code);
                    stopNote(midiNote, instrumentRef.current);
                    setActiveNotes(prev => {
                        const next = new Set(prev);
                        next.delete(midiNote);
                        return next;
                    });
                }
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
            playNote(note, velocity, instrumentRef.current); // Ya no es bloqueado por isLoading
            setActiveNotes(prev => new Set(prev).add(note));
        },
        // onNoteOff
        (note) => {
            stopNote(note, instrumentRef.current);
            setActiveNotes(prev => {
                const next = new Set(prev);
                next.delete(note);
                return next;
            });
        }
    );

    const renderKeys = () => {
        const keys = [];
        const blackKeys = [1, 3, 6, 8, 10]; // Patrón relativo de teclas negras en una octava
        
        const startMidi = inputMode === 'midi' ? midiRange[0] : 48;
        const endMidi = inputMode === 'midi' ? midiRange[1] : 84;

        let numWhiteKeys = 0;
        for (let m = startMidi; m <= endMidi; m++) {
            if (!blackKeys.includes(m % 12)) numWhiteKeys++;
        }

        const whiteKeyWidth = 100 / numWhiteKeys;
        let leftOffset = 0;

        for (let midi = startMidi; midi <= endMidi; midi++) {
            const isBlack = blackKeys.includes(midi % 12);
            const isActive = activeNotes.has(midi);
            const keyLabel = inputMode === 'keyboard' ? (layoutMap[midi]?.toUpperCase() || '') : '';

            if (isBlack) {
                const blackKeyWidth = whiteKeyWidth * 0.65; // 65% del ancho de una blanca
                keys.push(
                    <div 
                        key={midi}
                        style={{
                            position: 'absolute',
                            left: `${leftOffset - (blackKeyWidth / 2)}%`,
                            width: `${blackKeyWidth}%`,
                            height: '60%',
                            background: isActive ? 'var(--accent-primary)' : '#1e1e1e',
                            border: '1px solid #000',
                            borderBottomLeftRadius: '4px',
                            borderBottomRightRadius: '4px',
                            zIndex: 2,
                            boxShadow: isActive ? '0 0 15px var(--accent-primary)' : '2px 2px 5px rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            paddingBottom: '10px',
                            color: 'white',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            fontFamily: 'var(--font-mono)'
                        }}
                    >
                        {keyLabel}
                    </div>
                );
            } else {
                keys.push(
                    <div 
                        key={midi}
                        style={{
                            position: 'absolute',
                            left: `${leftOffset}%`,
                            width: `${whiteKeyWidth}%`,
                            height: '100%',
                            background: isActive ? '#e0f2fe' : '#ffffff',
                            border: '1px solid #ccc',
                            borderBottomLeftRadius: '4px',
                            borderBottomRightRadius: '4px',
                            zIndex: 1,
                            boxShadow: isActive ? 'inset 0 -5px 15px rgba(0,0,0,0.2)' : '1px 1px 3px rgba(0,0,0,0.2)',
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            paddingBottom: '15px',
                            color: '#333',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            fontFamily: 'var(--font-mono)'
                        }}
                    >
                        {keyLabel}
                    </div>
                );
                leftOffset += whiteKeyWidth; 
            }
        }
        return keys;
    };

    const keys = renderKeys();

    return (
        <div style={{ padding: '2rem 5%', maxWidth: '100%', margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button 
                    onClick={() => navigate('/dashboard')} 
                    className="btn-system"
                >
                    ← Volver
                </button>
                <div className="system-panel" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Modo Activo:</span>
                    <span className="text-mono" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                        {inputMode === 'keyboard' ? '⌨️ TECLADO VIRTUAL' : '🎹 HARDWARE MIDI'}
                    </span>
                </div>
            </div>

            <div className="system-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-base)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
                    <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
                        Piano Virtual
                        {isLoading && <span style={{ fontSize: '1rem', color: '#f59e0b', marginLeft: '10px', fontWeight: 'normal' }}>⏳ Descargando sonido...</span>}
                    </h1>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <select 
                            value={instrument} 
                            onChange={(e) => setInstrument(e.target.value)} 
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
                
                <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', textAlign: 'center' }}>
                    {inputMode === 'keyboard' ? 'Usa las teclas Z-M (octava inferior) y Q-P (octava superior) para tocar.\n¡Haz clic aquí si no escuchas el sonido!' : 'Toca tu piano MIDI. Asegúrate de tenerlo encendido.'}
                </p>

                <div style={{ position: 'relative', height: '220px', width: `100%`, margin: '0 auto' }}>
                    {keys}
                </div>
            </div>
        </div>
    );
};

export default FreePlay;
