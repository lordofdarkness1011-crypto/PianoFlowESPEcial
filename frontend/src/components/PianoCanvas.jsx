import React, { useEffect, useRef, useState } from 'react';

/**
 * PianoCanvas.jsx
 * 
 * Componente frontend que cumple las dos restricciones de diseño gráfico:
 * 1. Uso de HTML5 Canvas y requestAnimationFrame en lugar del DOM para renderizar notas.
 * 2. Comunicación asíncrona con el Web Worker para escuchar el hardware físico sin trabar los 60 FPS.
 */
const PianoCanvas = () => {
    const canvasRef = useRef(null);
    const workerRef = useRef(null);
    const requestRef = useRef();

    const [midiStatus, setMidiStatus] = useState('Iniciando...');

    useEffect(() => {
        // --- 1. INICIALIZACIÓN CONCURRENTE (WEB WORKER) ---
        workerRef.current = new Worker('/midiWorker.js');

        // Escuchar latidos desde el Worker (hardware físico)
        workerRef.current.onmessage = (event) => {
            const { type, note, velocity, message } = event.data;
            
            switch (type) {
                case 'MIDI_READY':
                    setMidiStatus(message);
                    break;
                case 'MIDI_ERROR':
                    setMidiStatus(`Error: ${message}`);
                    break;
                case 'NOTE_ON':
                    // TODO: Insertar la nota 'note' en el buffer para que el Canvas evalúe colisiones
                    console.log(`[MIDI] Tecla PRESIONADA: ${note} | Fuerza: ${velocity}`);
                    break;
                case 'NOTE_OFF':
                    // TODO: Detener efecto de brillo de la nota
                    console.log(`[MIDI] Tecla SOLTADA: ${note}`);
                    break;
                default:
                    break;
            }
        };

        // Encender hardware
        workerRef.current.postMessage({ type: 'INIT_MIDI' });

        return () => {
            // Liberar memoria
            workerRef.current.terminate();
            cancelAnimationFrame(requestRef.current);
        };
    }, []);

    useEffect(() => {
        // --- 2. MOTOR GRÁFICO (HTML5 CANVAS) ---
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Bucle de dibujado acoplado a la frecuencia de refresco de pantalla
        const renderLoop = (time) => {
            // Limpiar lienzo (borrado completo por frame evita manipulación de DOM)
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // DIBUJAR AQUI:
            // ctx.fillStyle = '#00ffcc';
            // ctx.fillRect(x, pos_y, ancho, alto); 
            // pos_y = pos_y + velocidad; // Caída en cascada tipo Synthesia

            requestRef.current = requestAnimationFrame(renderLoop);
        };

        // Arrancar el motor a 60 FPS estables
        requestRef.current = requestAnimationFrame(renderLoop);
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2>Motor Gráfico: PianoFlow Web</h2>
            <p>Estado de Hardware: <strong style={{ color: '#00ffcc' }}>{midiStatus}</strong></p>
            
            {/* Única superficie de pintado. NO usamos <div> para renderizar las notas musicales */}
            <canvas 
                ref={canvasRef} 
                width={800} 
                height={600} 
                style={{ border: '2px solid #555', backgroundColor: '#111' }}
            />
        </div>
    );
};

export default PianoCanvas;
