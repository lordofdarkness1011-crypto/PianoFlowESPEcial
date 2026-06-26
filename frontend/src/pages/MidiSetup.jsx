import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { InputContext } from '../context/InputContext';
import { useMidi } from '../hooks/useMidi';

const MidiSetup = () => {
    const navigate = useNavigate();
    const { inputMode, setInputMode, selectedMidiDevice, setSelectedMidiDevice, midiRange, setMidiRange } = useContext(InputContext);
    const [status, setStatus] = useState('Buscando dispositivos...');
    const [logs, setLogs] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [devices, setDevices] = useState([]);

    // Estado de calibración
    const [calibMode, setCalibMode] = useState('idle'); // idle | waiting_low | waiting_high | done
    const [tempLow, setTempLow] = useState(null);

    useMidi(
        // onNoteOn
        (note, velocity) => {
            if (calibMode === 'waiting_low') {
                setTempLow(note);
                setCalibMode('waiting_high');
                setLogs(prev => [`Calibración: Límite inferior fijado en nota ${note}. Ahora presiona la más aguda.`, ...prev].slice(0, 10));
                return;
            } else if (calibMode === 'waiting_high') {
                const low = Math.min(tempLow, note);
                const high = Math.max(tempLow, note);
                setMidiRange([low, high]);
                setCalibMode('done');
                setLogs(prev => [`Calibración: Límite superior fijado en nota ${note}. Rango establecido: [${low}, ${high}].`, ...prev].slice(0, 10));
                return;
            }

            setLogs(prev => [`Nota presionada: ${note} (Velocidad: ${velocity})`, ...prev].slice(0, 10));
        },
        // onNoteOff
        (note) => {
            setLogs(prev => [`Nota soltada: ${note}`, ...prev].slice(0, 10));
        },
        // onStatusChange
        (message, connected) => {
            setStatus(message);
            setIsConnected(connected);
        },
        // onDevicesUpdate
        (devList) => {
            setDevices(devList);
        }
    );

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <button 
                onClick={() => navigate('/dashboard')} 
                className="btn-system"
                style={{ marginBottom: '2rem' }}>
                ← Volver al Dashboard
            </button>

            <div className="system-panel" style={{ marginBottom: '2rem' }}>
                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: 'var(--text-main)' }}>Modo de Entrada Preferido</h2>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <button 
                        onClick={() => setInputMode('keyboard')}
                        className={`btn-system ${inputMode === 'keyboard' ? 'btn-accent' : ''}`}
                        style={{ flex: 1, padding: '12px', opacity: inputMode === 'keyboard' ? 1 : 0.6 }}
                    >
                        ⌨️ Teclado del PC
                    </button>
                    <button 
                        onClick={() => setInputMode('midi')}
                        className={`btn-system ${inputMode === 'midi' ? 'btn-accent' : ''}`}
                        style={{ flex: 1, padding: '12px', opacity: inputMode === 'midi' ? 1 : 0.6 }}
                    >
                        🎹 Hardware MIDI
                    </button>
                </div>
            </div>

            <div className="system-panel" style={{ marginBottom: '2rem', opacity: inputMode === 'midi' ? 1 : 0.4 }}>
                <h1 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem' }}>Configuración de Hardware MIDI</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Esta vista verifica que tu teclado USB/MIDI esté enviando señales correctamente al sistema distribuido.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-base)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '2.5rem' }}>🔌</div>
                    <div>
                        <h3 style={{ margin: '0 0 4px 0' }}>Estado del Puerto</h3>
                        <span className="text-mono" style={{ color: isConnected ? 'var(--accent-green)' : '#f59e0b', fontWeight: 'bold' }}>{status}</span>
                    </div>
                </div>

                {isConnected && devices.length > 0 && (
                    <div style={{ background: 'var(--bg-base)', padding: '1rem 1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1rem' }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>Seleccionar Dispositivo Físico</h3>
                        <select 
                            value={selectedMidiDevice} 
                            onChange={(e) => setSelectedMidiDevice(e.target.value)}
                            className="system-input"
                            style={{ width: '100%', maxWidth: '400px', cursor: 'pointer', background: 'var(--bg-surface)' }}
                        >
                            <option value="all">Escuchar en Todos los Puertos (Por Defecto)</option>
                            {devices.map(d => (
                                <option key={d.id} value={d.id}>{d.name} {d.manufacturer ? `(${d.manufacturer})` : ''}</option>
                            ))}
                        </select>
                    </div>
                )}

                {isConnected && (
                    <div style={{ background: 'var(--bg-base)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--accent-purple)' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: 'var(--accent-purple)' }}>Calibración de Octavas</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Ajusta el tamaño del piano virtual para que coincida con tu instrumento físico (Rango actual: {midiRange[0]} a {midiRange[1]}).
                        </p>
                        
                        {calibMode === 'idle' || calibMode === 'done' ? (
                            <button 
                                className="btn-accent" 
                                onClick={() => {
                                    setCalibMode('waiting_low');
                                    setLogs(prev => [`Calibración: Presiona la tecla MÁS GRAVE (izquierda) de tu piano.`, ...prev].slice(0, 10));
                                }}
                            >
                                {calibMode === 'done' ? 'Recalibrar Piano' : 'Iniciar Calibración'}
                            </button>
                        ) : calibMode === 'waiting_low' ? (
                            <div style={{ padding: '10px', background: '#3b82f633', color: '#60a5fa', borderRadius: '8px', fontWeight: 'bold' }}>
                                👉 Presiona la tecla MÁS GRAVE (izquierda) de tu piano...
                            </div>
                        ) : (
                            <div style={{ padding: '10px', background: '#8b5cf633', color: '#a78bfa', borderRadius: '8px', fontWeight: 'bold' }}>
                                👉 Presiona la tecla MÁS AGUDA (derecha) de tu piano...
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="system-panel" style={{ opacity: inputMode === 'midi' ? 1 : 0.4 }}>
                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: 'var(--text-muted)' }}>Log de Señales (Test de Latencia)</h2>
                <div style={{ background: '#000', borderRadius: '8px', padding: '1rem', minHeight: '200px', overflowY: 'auto' }}>
                    {logs.length === 0 ? (
                        <p className="text-mono" style={{ color: '#4b5563', margin: 0 }}>Esperando que presiones una tecla en tu piano...</p>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="text-mono" style={{ color: '#10b981', fontSize: '0.9rem', marginBottom: '4px' }}>
                                {'>'} {log}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default MidiSetup;
