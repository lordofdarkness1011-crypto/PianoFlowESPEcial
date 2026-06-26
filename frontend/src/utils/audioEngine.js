import Soundfont from 'soundfont-player';

let audioCtx = null;
let masterCompressor = null;
let masterGain = null;
const instrumentsCache = {};
let currentInstrumentName = 'acoustic_grand_piano';
const activeNotes = {};

// Cache for real acoustic drum samples
let drumSamples = {};
const DRUM_URLS = {
    kick: 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/kick.wav',
    snare: 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/snare.wav',
    hihat: 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/hihat.wav',
    openhat: 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/openhat.wav',
    tom: 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/tom.wav',
    ride: 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/ride.wav',
    clap: 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/clap.wav',
    boom: 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/boom.wav',
    tink: 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/tink.wav',
};

export const initAudio = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Restaurar normalización global (Ingeniero de Sonido Virtual)
        masterCompressor = audioCtx.createDynamicsCompressor();
        masterCompressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
        masterCompressor.knee.setValueAtTime(12, audioCtx.currentTime);
        masterCompressor.ratio.setValueAtTime(10, audioCtx.currentTime);
        masterCompressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
        masterCompressor.release.setValueAtTime(0.1, audioCtx.currentTime);

        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(1.0, audioCtx.currentTime); // Reducido para evitar daño a los parlantes (estaba en 4.0)

        // Limiter final para evitar clipping digital absoluto
        const limiter = audioCtx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-1, audioCtx.currentTime);
        limiter.knee.setValueAtTime(0, audioCtx.currentTime);
        limiter.ratio.setValueAtTime(20, audioCtx.currentTime);
        limiter.attack.setValueAtTime(0.001, audioCtx.currentTime);
        limiter.release.setValueAtTime(0.05, audioCtx.currentTime);

        masterCompressor.connect(masterGain);
        masterGain.connect(limiter);
        limiter.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
};

let isUnlocked = false;

const forceUnlock = () => {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            isUnlocked = true;
        }).catch(() => {});
    } else if (audioCtx && audioCtx.state === 'running') {
        isUnlocked = true;
    }
};

// Brute-force Web Audio unlocker: Escucha cualquier interacción global
window.addEventListener('mousedown', forceUnlock, { once: false });
window.addEventListener('keydown', forceUnlock, { once: false });
window.addEventListener('touchstart', forceUnlock, { once: false });

export const loadInstrument = async (instrumentName) => {
    initAudio();
    if (instrumentsCache[instrumentName]) {
        currentInstrumentName = instrumentName;
        return; // Ya está cargado
    }
    
    currentInstrumentName = instrumentName;
    
    try {
        if (instrumentName === 'drum_kit') {
            if (Object.keys(drumSamples).length === 0) {
                const fetchPromises = Object.entries(DRUM_URLS).map(async ([name, url]) => {
                    const response = await fetch(url);
                    const arrayBuffer = await response.arrayBuffer();
                    drumSamples[name] = await audioCtx.decodeAudioData(arrayBuffer);
                });
                await Promise.all(fetchPromises);
            }
            instrumentsCache['drum_kit'] = true; // Virtual flag
        } else {
            instrumentsCache[instrumentName] = await Soundfont.instrument(audioCtx, instrumentName, { destination: masterCompressor });
        }
    } catch (error) {
        console.error("Error cargando soundfont:", error);
    }
};

const CONTINUOUS_INSTRUMENTS = [
    // Órganos y Acordeones
    'drawbar_organ', 'percussive_organ', 'rock_organ', 'church_organ', 'reed_organ', 'accordion', 'harmonica', 'tango_accordion',
    // Cuerdas Frotadas
    'violin', 'viola', 'cello', 'contrabass', 'tremolo_strings', 'string_ensemble_1', 'string_ensemble_2', 'synthstrings_1', 'synthstrings_2',
    // Metales y Viento
    'trumpet', 'trombone', 'tuba', 'muted_trumpet', 'french_horn', 'brass_section', 'synthbrass_1', 'synthbrass_2',
    'soprano_sax', 'alto_sax', 'tenor_sax', 'baritone_sax', 'oboe', 'english_horn', 'bassoon', 'clarinet', 'piccolo', 'flute', 'recorder', 'pan_flute', 'blown_bottle', 'shakuhachi', 'whistle', 'ocarina',
    // Voces y Coros
    'choir_aahs', 'voice_oohs', 'synth_voice',
    // Sintetizadores (Leads y Pads)
    'lead_1_square', 'lead_2_sawtooth', 'lead_3_calliope', 'lead_4_chiff', 'lead_5_charang', 'lead_6_voice', 'lead_7_fifths', 'lead_8_bass__lead',
    'pad_1_new_age', 'pad_2_warm', 'pad_3_polysynth', 'pad_4_choir', 'pad_5_bowed', 'pad_6_metallic', 'pad_7_halo', 'pad_8_sweep',
    // Étnicos continuos
    'bagpipe', 'shanai', 'fiddle'
];

// Asignamos multiplicadores de volumen específicos porque los Soundfonts varían dramáticamente.
const getInstrumentGainMultiplier = (name) => {
    if (!name) return 1.5;
    const lower = name.toLowerCase();
    
    // Suaves - necesitan mucho boost
    if (lower.includes('guitar') || lower.includes('bass') || lower.includes('harp') || lower.includes('flute') || lower.includes('recorder') || lower.includes('whistle') || lower.includes('ocarina') || lower.includes('bottle')) return 3.0;
    
    // Medios-suaves - necesitan boost
    if (lower.includes('piano') || lower.includes('clav') || lower.includes('celesta') || lower.includes('music_box')) return 2.2;
    if (lower.includes('string') || lower.includes('violin') || lower.includes('viola') || lower.includes('cello')) return 2.0;
    if (lower.includes('choir') || lower.includes('voice')) return 2.0;
    
    // Medios 
    if (lower.includes('drum') || lower.includes('percussive') || lower.includes('marimba') || lower.includes('xylophone')) return 1.5;
    if (lower.includes('sax') || lower.includes('oboe') || lower.includes('bassoon') || lower.includes('clarinet')) return 1.2;
    
    // Fuertes - reducir ganancia
    if (lower.includes('organ') || lower.includes('accordion')) return 0.7;
    if (lower.includes('trumpet') || lower.includes('trombone') || lower.includes('tuba') || lower.includes('horn') || lower.includes('brass')) return 0.6;
    if (lower.includes('lead') || lower.includes('pad') || lower.includes('synth') || lower.includes('orchestra_hit')) return 0.5;
    
    return 1.8; // Base normalizada genérica
};

export const playNote = (midiNote, velocity = 100, instrumentName = currentInstrumentName) => {
    const instrument = instrumentsCache[instrumentName];
    if (!instrument && instrumentName !== 'drum_kit') return;
    
    // Identificador único para evitar cruce de instrumentos o notas remotos
    const noteKey = `${midiNote}_${instrumentName}`;
    if (activeNotes[noteKey]) return; // Evitar disparar múltiples veces la misma tecla sostenida

    let instName = instrumentName;
    let noteToPlay = midiNote;
    let drumGainMultiplier = 1.0;

    let isAcousticDrum = false;
    let drumSampleKey = null;
    let drumPlaybackRate = 1.0;

    if (instrumentName === 'drum_kit') {
        const DRUM_MAP = {
            // === OCTAVA 3 (MIDI 36-47): Batería Pesada / Cinemática ===
            36: { sample: 'boom', rate: 0.8, gain: 1.5 }, // C3 - Deep Boom Kick
            37: { sample: 'boom', rate: 1.0, gain: 1.2 }, // C#3 - High Boom
            38: { sample: 'snare', rate: 0.8, gain: 1.2 }, // D3 - Deep Snare
            39: { sample: 'clap', rate: 0.8, gain: 1.2 }, // D#3 - Deep Clap
            40: { sample: 'tom', rate: 0.6, gain: 1.5 }, // E3 - Very Low Tom
            41: { sample: 'tom', rate: 0.7, gain: 1.5 }, // F3 - Low Floor Tom
            42: { sample: 'hihat', rate: 0.8, gain: 1.0 }, // F#3 - Dark Hat
            43: { sample: 'tom', rate: 0.8, gain: 1.5 }, // G3 - Mid Floor Tom
            44: { sample: 'hihat', rate: 0.9, gain: 1.0 }, // G#3
            45: { sample: 'tom', rate: 0.9, gain: 1.5 }, // A3 - Low Tom
            46: { sample: 'openhat', rate: 0.8, gain: 1.0 }, // A#3 - Dark Open Hat
            47: { sample: 'tom', rate: 1.0, gain: 1.5 }, // B3 - Mid Tom

            // === OCTAVA 4 (MIDI 48-59): Kit Acústico Estándar (Teclado PC Z-M) ===
            48: { sample: 'kick', rate: 1.0, gain: 1.2 }, // C4 - Standard Kick
            49: { sample: 'tink', rate: 0.8, gain: 1.0 }, // C#4 - Rimshot
            50: { sample: 'snare', rate: 1.0, gain: 1.0 }, // D4 - Standard Snare
            51: { sample: 'clap', rate: 1.0, gain: 1.0 }, // D#4 - Standard Clap
            52: { sample: 'hihat', rate: 1.0, gain: 0.8 }, // E4 - Closed Hat
            53: { sample: 'tom', rate: 0.9, gain: 1.2 }, // F4 - Low Tom
            54: { sample: 'openhat', rate: 1.0, gain: 0.8 }, // F#4 - Open Hat
            55: { sample: 'tom', rate: 1.1, gain: 1.2 }, // G4 - Mid Tom
            56: { sample: 'ride', rate: 1.0, gain: 1.0 }, // G#4 - Ride
            57: { sample: 'tom', rate: 1.3, gain: 1.2 }, // A4 - High Tom
            58: { sample: 'tink', rate: 1.0, gain: 1.0 }, // A#4 - Bell
            59: { sample: 'openhat', rate: 0.5, gain: 1.5 }, // B4 - Crash (Open hat slowed down!)

            // === OCTAVA 5 (MIDI 60-71): Kit Agudo (Teclado PC Q-P) ===
            60: { sample: 'kick', rate: 1.2, gain: 1.0 }, // C5
            61: { sample: 'tink', rate: 1.2, gain: 1.0 }, // C#5
            62: { sample: 'snare', rate: 1.2, gain: 1.0 }, // D5
            63: { sample: 'clap', rate: 1.2, gain: 1.0 }, // D#5
            64: { sample: 'hihat', rate: 1.2, gain: 1.0 }, // E5
            65: { sample: 'tom', rate: 1.5, gain: 1.0 }, // F5
            66: { sample: 'openhat', rate: 1.2, gain: 1.0 }, // F#5
            67: { sample: 'tom', rate: 1.7, gain: 1.0 }, // G5
            68: { sample: 'ride', rate: 1.2, gain: 1.0 }, // G#5
            69: { sample: 'tom', rate: 1.9, gain: 1.0 }, // A5
            70: { sample: 'tink', rate: 1.5, gain: 1.0 }, // A#5
            71: { sample: 'openhat', rate: 0.7, gain: 1.5 }, // B5
        };

        let mappedNote = midiNote;
        if (midiNote < 36 || midiNote > 71) {
            mappedNote = 48 + (midiNote % 12);
        }

        const mapping = DRUM_MAP[mappedNote];
        if (mapping && drumSamples[mapping.sample]) {
            isAcousticDrum = true;
            drumSampleKey = mapping.sample;
            drumPlaybackRate = mapping.rate;
            drumGainMultiplier = mapping.gain;
        }
    }

    if (!isAcousticDrum) {
        const actualInstrument = instrumentsCache[instName];
        if (!actualInstrument) return;
    }

    const play = () => {
        const baseMultiplier = getInstrumentGainMultiplier(instName) * drumGainMultiplier;
        const normalizedGain = Math.min((velocity / 127) * baseMultiplier, 3.5);

        if (isNaN(normalizedGain)) {
            alert(`Error: Ganancia NaN. Velocidad: ${velocity}`);
            return;
        }

        try {
            if (isAcousticDrum) {
                // Play raw acoustic sample
                const source = audioCtx.createBufferSource();
                source.buffer = drumSamples[drumSampleKey];
                source.playbackRate.value = drumPlaybackRate;
                
                const gainNode = audioCtx.createGain();
                gainNode.gain.value = normalizedGain * 2.0; // Drums need a bit more volume
                
                source.connect(gainNode);
                gainNode.connect(masterCompressor);
                
                source.start();
                activeNotes[noteKey] = { stop: () => { /* Drums auto-stop */ } };
            } else {
                // Play regular soundfont
                const shouldLoop = CONTINUOUS_INSTRUMENTS.includes(instName);
                const node = instrumentsCache[instName].play(noteToPlay, audioCtx.currentTime, {
                    gain: normalizedGain,
                    loop: shouldLoop
                });
                activeNotes[noteKey] = node;
            }
        } catch (e) {
            console.error('Error reproduciendo nota:', e);
        }
    };

    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(play).catch(console.error);
    } else {
        play();
    }
};

export const stopNote = (midiNote, instrumentName = currentInstrumentName) => {
    const noteKey = `${midiNote}_${instrumentName}`;
    if (activeNotes[noteKey]) {
        activeNotes[noteKey].stop(audioCtx.currentTime + 0.1); // Pequeño fadeout nativo
        delete activeNotes[noteKey];
    }
};
