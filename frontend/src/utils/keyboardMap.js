// Mapeo por CÓDIGO FÍSICO (e.code), garantiza que siempre suene la misma tecla física sin importar el idioma del SO.
export const CODE_TO_MIDI = {
    // Blancas abajo (C3 a E4)
    'KeyZ': 48, 'KeyX': 50, 'KeyC': 52, 'KeyV': 53, 'KeyB': 55, 'KeyN': 57, 'KeyM': 59, 'Comma': 60, 'Period': 62, 'Slash': 64,
    // Negras abajo
    'KeyS': 49, 'KeyD': 51, 'KeyG': 54, 'KeyH': 56, 'KeyJ': 58, 'KeyL': 61, 'Semicolon': 63,
    
    // Blancas arriba (F4 a C6)
    'KeyQ': 65, 'KeyW': 67, 'KeyE': 69, 'KeyR': 71, 'KeyT': 72, 'KeyY': 74, 'KeyU': 76, 'KeyI': 77, 'KeyO': 79, 'KeyP': 81, 'BracketLeft': 83, 'BracketRight': 84,
    // Negras arriba
    'Digit2': 66, 'Digit3': 68, 'Digit4': 70, 'Digit6': 73, 'Digit7': 75, 'Digit9': 78, 'Digit0': 80, 'Minus': 82
};

// Mapeos visuales de teclas (solo para mostrar la etiqueta en pantalla)
export const KEYBOARD_LAYOUTS = {
    'US': {
        // Blancas abajo
        48: 'z', 50: 'x', 52: 'c', 53: 'v', 55: 'b', 57: 'n', 59: 'm', 60: ',', 62: '.', 64: '/',
        // Negras abajo
        49: 's', 51: 'd', 54: 'g', 56: 'h', 58: 'j', 61: 'l', 63: ';',
        // Blancas arriba
        65: 'q', 67: 'w', 69: 'e', 71: 'r', 72: 't', 74: 'y', 76: 'u', 77: 'i', 79: 'o', 81: 'p', 83: '[', 84: ']',
        // Negras arriba
        66: '2', 68: '3', 70: '4', 73: '6', 75: '7', 78: '9', 80: '0', 82: '-'
    },
    'LATAM': {
        // Blancas abajo
        48: 'z', 50: 'x', 52: 'c', 53: 'v', 55: 'b', 57: 'n', 59: 'm', 60: ',', 62: '.', 64: '-',
        // Negras abajo
        49: 's', 51: 'd', 54: 'g', 56: 'h', 58: 'j', 61: 'l', 63: 'ñ',
        // Blancas arriba
        65: 'q', 67: 'w', 69: 'e', 71: 'r', 72: 't', 74: 'y', 76: 'u', 77: 'i', 79: 'o', 81: 'p', 83: '´', 84: '+',
        // Negras arriba
        66: '2', 68: '3', 70: '4', 73: '6', 75: '7', 78: '9', 80: '0', 82: "'"
    },
    'ES': {
        // Blancas abajo
        48: 'z', 50: 'x', 52: 'c', 53: 'v', 55: 'b', 57: 'n', 59: 'm', 60: ',', 62: '.', 64: '-',
        // Negras abajo
        49: 's', 51: 'd', 54: 'g', 56: 'h', 58: 'j', 61: 'l', 63: 'ñ',
        // Blancas arriba
        65: 'q', 67: 'w', 69: 'e', 71: 'r', 72: 't', 74: 'y', 76: 'u', 77: 'i', 79: 'o', 81: 'p', 83: '`', 84: '+',
        // Negras arriba
        66: '2', 68: '3', 70: '4', 73: '6', 75: '7', 78: '9', 80: '0', 82: "'"
    }
};

// Función para detectar el layout basándose en combinaciones de code y key
export const detectLayout = (code, key) => {
    if (code === 'Semicolon' && key.toLowerCase() === 'ñ') return 'LATAM'; // O ES
    if (code === 'BracketLeft' && (key === '´' || key === '{')) return 'LATAM';
    if (code === 'BracketLeft' && (key === '`' || key === '^')) return 'ES';
    if (code === 'Slash' && key === '-') return 'LATAM';
    if (code === 'Slash' && key === '/') return 'US';
    if (code === 'Semicolon' && key === ';') return 'US';
    return null; // Si no hay detección clara, no cambiar
};
