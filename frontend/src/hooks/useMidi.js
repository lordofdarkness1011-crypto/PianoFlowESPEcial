import { useEffect, useRef, useContext } from 'react';
import { InputContext } from '../context/InputContext';

export const useMidi = (onNoteOn, onNoteOff, onStatusChange, onDevicesUpdate) => {
    const { inputMode, selectedMidiDevice } = useContext(InputContext);
    const workerRef = useRef(null);
    const midiAccessRef = useRef(null);

    // Keep track of the latest callbacks to avoid stale closures
    const callbacksRef = useRef({ onNoteOn, onNoteOff, onStatusChange, onDevicesUpdate });
    useEffect(() => {
        callbacksRef.current = { onNoteOn, onNoteOff, onStatusChange, onDevicesUpdate };
    }, [onNoteOn, onNoteOff, onStatusChange, onDevicesUpdate]);

    useEffect(() => {
        if (inputMode !== 'midi') return;

        // Web Worker for asynchronous hardware data processing
        workerRef.current = new Worker('/midiWorker.js?v=' + Date.now());
        workerRef.current.onmessage = (e) => {
            const { type, note, velocity } = e.data;
            const cb = callbacksRef.current;
            if (type === 'NOTE_ON' && cb.onNoteOn) cb.onNoteOn(note, velocity);
            else if (type === 'NOTE_OFF' && cb.onNoteOff) cb.onNoteOff(note);
        };

        const handleMidiMessage = (event) => {
            // Offload parsing and processing to the Web Worker
            workerRef.current.postMessage({ type: 'PROCESS_RAW', data: event.data });
        };

        const initMidi = async () => {
            // requestMIDIAccess MUST be called on the main thread (window), not in the worker.
            if (navigator.requestMIDIAccess) {
                try {
                    const access = await navigator.requestMIDIAccess();
                    midiAccessRef.current = access;
                    
                    const inputs = Array.from(access.inputs.values());
                    
                    if (callbacksRef.current.onDevicesUpdate) {
                        callbacksRef.current.onDevicesUpdate(inputs.map(i => ({ id: i.id, name: i.name, manufacturer: i.manufacturer })));
                    }

                    if (inputs.length === 0) {
                        if (callbacksRef.current.onStatusChange) callbacksRef.current.onStatusChange('No se detectaron teclados MIDI conectados.', false);
                        return;
                    }

                    let boundCount = 0;
                    inputs.forEach(input => {
                        if (!selectedMidiDevice || selectedMidiDevice === 'all' || input.id === selectedMidiDevice) {
                            input.onmidimessage = handleMidiMessage;
                            boundCount++;
                        } else {
                            input.onmidimessage = null;
                        }
                    });

                    if (boundCount === 0) {
                        if (callbacksRef.current.onStatusChange) callbacksRef.current.onStatusChange('El dispositivo seleccionado no está disponible.', false);
                    } else {
                        if (callbacksRef.current.onStatusChange) callbacksRef.current.onStatusChange(`Escuchando en ${boundCount} dispositivo(s) MIDI.`, true);
                    }
                } catch (err) {
                    if (callbacksRef.current.onStatusChange) callbacksRef.current.onStatusChange(`Fallo al acceder a MIDI: ${err.message}`, false);
                }
            } else {
                if (callbacksRef.current.onStatusChange) callbacksRef.current.onStatusChange('Web MIDI API no soportada en este navegador (Asegúrate de estar en localhost o HTTPS).', false);
            }
        };

        initMidi();

        return () => {
            if (workerRef.current) workerRef.current.terminate();
            if (midiAccessRef.current) {
                Array.from(midiAccessRef.current.inputs.values()).forEach(i => i.onmidimessage = null);
            }
        };
    }, [inputMode, selectedMidiDevice]);
};
