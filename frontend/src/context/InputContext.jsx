import React, { createContext, useState, useEffect } from 'react';

export const InputContext = createContext();

export const InputProvider = ({ children }) => {
    const [inputMode, setInputMode] = useState(() => {
        return localStorage.getItem('pianoflow_input_mode') || 'keyboard';
    });

    const [keyboardLayout, setKeyboardLayout] = useState(() => {
        const stored = localStorage.getItem('pianoflow_keyboard_layout');
        if (stored) return stored;
        return navigator.language.toLowerCase().startsWith('es') ? 'LATAM' : 'US';
    });

    const [selectedMidiDevice, setSelectedMidiDevice] = useState(() => {
        return localStorage.getItem('pianoflow_midi_device') || 'all';
    });

    const [midiRange, setMidiRange] = useState(() => {
        const stored = localStorage.getItem('pianoflow_midi_range');
        if (stored) {
            try { return JSON.parse(stored); } catch(e) {}
        }
        return [48, 84]; // Default 3 octavas (C3 a C6)
    });

    useEffect(() => {
        localStorage.setItem('pianoflow_input_mode', inputMode);
        localStorage.setItem('pianoflow_keyboard_layout', keyboardLayout);
        localStorage.setItem('pianoflow_midi_device', selectedMidiDevice);
        localStorage.setItem('pianoflow_midi_range', JSON.stringify(midiRange));
    }, [inputMode, keyboardLayout, selectedMidiDevice, midiRange]);

    return (
        <InputContext.Provider value={{ 
            inputMode, setInputMode, 
            keyboardLayout, setKeyboardLayout,
            selectedMidiDevice, setSelectedMidiDevice,
            midiRange, setMidiRange
        }}>
            {children}
        </InputContext.Provider>
    );
};
