/**
 * midiWorker.js
 * 
 * Este Web Worker maneja el procesamiento de la información bruta de la Web MIDI API,
 * aislando el parseo y cálculo de señales del hardware físico fuera del hilo principal de React.
 */

// Escuchar mensajes desde el hilo principal (React)
self.onmessage = (e) => {
    const { type, data } = e.data;
    
    if (type === 'PROCESS_RAW') {
        // Recibe el array crudo [command, note, velocity] desde el main thread
        const [command, note, velocity] = data;
        
        // Command 144-159 (0x90-0x9F) es Note On para canales 1-16
        // Command 128-143 (0x80-0x8F) es Note Off para canales 1-16
        const messageType = command & 0xF0; // Máscara para ignorar el canal
        
        if (messageType === 144 && velocity > 0) {
            // Enviar procesado de vuelta al hilo principal
            self.postMessage({
                type: 'NOTE_ON',
                note: note,
                velocity: velocity
            });
        } else if (messageType === 128 || (messageType === 144 && velocity === 0)) {
            self.postMessage({
                type: 'NOTE_OFF',
                note: note
            });
        }
    }
};
