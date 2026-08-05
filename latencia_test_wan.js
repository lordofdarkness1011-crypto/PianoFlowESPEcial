/**
 * latencia_test_wan.js
 * =====================
 * WAN / Real Cloud Latency Test — P2 Evidence
 *
 * Purpose:
 *   Tests HTTP REST and WebSocket latency against the REAL deployed
 *   Render.com server (no Clumsy emulation — real WAN conditions).
 *   This serves as the "Lab vs. Real Network" comparison required by
 *   the professor's P2 feedback (External Validity).
 *
 * Output files:
 *   resultados_wan_http.csv   — HTTP REST RTT over real WAN
 *   resultados_wan_ws.csv     — WebSocket RTT over real WAN
 *
 * Usage:
 *   1. Set WAN_SERVER_URL below to your actual Render.com backend URL
 *      e.g. https://pianoflows-api.onrender.com
 *   2. node latencia_test_wan.js
 *
 * NOTE: No Clumsy needed — real WAN latency is measured naturally.
 *       Run this WITHOUT any packet-loss emulation active.
 */

const axios  = require('axios');
const io     = require('socket.io-client');
const fs     = require('fs');

// ══════════════════════════════════════════════════════════════════════════
// ► CONFIGURE THIS — set your real Render.com backend URL here
// ══════════════════════════════════════════════════════════════════════════
const WAN_SERVER_URL = 'https://pianoflowbackend.onrender.com';

// Experiment parameters (same as original LAN test for comparability)
const CONCURRENCY            = 4;
const ITERATIONS_PER_CLIENT  = 1000;
const WARMUP_ITERATIONS      = 100;
const NOTES_PER_SECOND       = 25;    // same load: 4×25 = 100 events/s
const INTERVAL_MS            = 1000 / NOTES_PER_SECOND;

const CSV_HTTP = 'resultados_wan_http.csv';
const CSV_WS   = 'resultados_wan_ws.csv';

// ══════════════════════════════════════════════════════════════════════════
// Startup checks
// ══════════════════════════════════════════════════════════════════════════
if (WAN_SERVER_URL.includes('YOUR_APP')) {
    console.error('\n[ERROR] You must set WAN_SERVER_URL to your actual Render.com URL.');
    console.error('  Open latencia_test_wan.js and replace the placeholder.\n');
    process.exit(1);
}

console.log(`\n WAN LATENCY TEST — Real Cloud Server`);
console.log(`  Target: ${WAN_SERVER_URL}`);
console.log(`  Clients: ${CONCURRENCY}  |  Iterations: ${ITERATIONS_PER_CLIENT}/client`);
console.log(`  Warmup: ${WARMUP_ITERATIONS} iters discarded  |  Steady: ${ITERATIONS_PER_CLIENT - WARMUP_ITERATIONS} recorded`);
console.log(`  Load: ${CONCURRENCY * NOTES_PER_SECOND} events/s total (same as LAN experiment)\n`);

// Initialise CSV files with headers that match the existing CSVs
fs.writeFileSync(CSV_HTTP, 'Fase,ClienteID,Iteracion,Latencia_ms,CPU_Load,RAM_MB,Status\n');
fs.writeFileSync(CSV_WS,   'Fase,ClienteID,Iteracion,Latencia_ms,CPU_Load,RAM_MB,Status\n');

// ══════════════════════════════════════════════════════════════════════════
// 1. HTTP REST CLIENT
// ══════════════════════════════════════════════════════════════════════════
async function runHTTPClient(clientId) {
    let iteration = 0;

    return new Promise(resolve => {
        const timer = setInterval(async () => {
            if (iteration >= ITERATIONS_PER_CLIENT) {
                clearInterval(timer);
                resolve();
                return;
            }

            iteration++;
            const start  = Date.now();
            const warmup = iteration <= WARMUP_ITERATIONS;
            const phase  = warmup ? 'WARMUP' : 'STEADY';

            try {
                const res = await axios.post(
                    `${WAN_SERVER_URL}/api/test/note`,
                    { midi: 60 },
                    { timeout: 10000 }   // 10 s timeout — WAN can be slow
                );
                const rtt = Date.now() - start;
                const cpu = res.data?.cpuLoad || 0;
                const ram = res.data?.ramMB   || 0;
                fs.appendFileSync(CSV_HTTP, `${phase},${clientId},${iteration},${rtt},${cpu},${ram},OK\n`);
            } catch (err) {
                const rtt = Date.now() - start;
                const status = err.code === 'ECONNABORTED' ? 'TIMEOUT' : 'ERROR';
                fs.appendFileSync(CSV_HTTP, `${phase},${clientId},${iteration},${rtt},0,0,${status}\n`);
            }
        }, INTERVAL_MS);
    });
}

// ══════════════════════════════════════════════════════════════════════════
// 2. WEBSOCKET CLIENT
// ══════════════════════════════════════════════════════════════════════════
function runWSClient(clientId) {
    return new Promise(resolve => {
        const socket = io(WAN_SERVER_URL, {
            transports: ['websocket'],
            timeout:    10000,
            reconnectionAttempts: 3,
        });

        let iteration          = 0;
        let requestsDispatched = 0;
        let timer              = null;

        socket.on('connect', () => {
            console.log(`  [WS] Client ${clientId} connected (WAN socket id: ${socket.id})`);

            timer = setInterval(() => {
                if (requestsDispatched >= ITERATIONS_PER_CLIENT) {
                    clearInterval(timer);
                    return;
                }
                requestsDispatched++;
                const start = Date.now();
                socket.emit('test_latencia_ws', {
                    _testStart: start,
                    _testIter:  requestsDispatched,
                });
            }, INTERVAL_MS);
        });

        socket.on('test_latencia_ws_response', (data) => {
            const rtt    = Date.now() - data._testStart;
            const warmup = data._testIter <= WARMUP_ITERATIONS;
            const phase  = warmup ? 'WARMUP' : 'STEADY';
            iteration++;

            fs.appendFileSync(
                CSV_WS,
                `${phase},${clientId},${data._testIter},${rtt},${data.cpuLoad || 0},${data.ramMB || 0},OK\n`
            );

            if (iteration >= ITERATIONS_PER_CLIENT) {
                clearInterval(timer);
                socket.disconnect();
                resolve();
            }
        });

        socket.on('connect_error', (err) => {
            console.error(`  [WS] Client ${clientId} connect_error: ${err.message}`);
            fs.appendFileSync(CSV_WS, `ERROR,${clientId},${requestsDispatched},0,0,0,CONNECT_ERROR\n`);
        });

        socket.on('disconnect', (reason) => {
            if (iteration < ITERATIONS_PER_CLIENT) {
                // Premature disconnect — log remaining as errors
                const remaining = ITERATIONS_PER_CLIENT - iteration;
                for (let i = 0; i < remaining; i++) {
                    fs.appendFileSync(CSV_WS, `ERROR,${clientId},${iteration + i},0,0,0,DISCONNECT\n`);
                }
                clearInterval(timer);
                resolve();
            }
        });
    });
}

// ══════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ══════════════════════════════════════════════════════════════════════════
async function runExperiment() {
    // ── HTTP phase ──────────────────────────────────────────────────────
    console.log('[1/2] Testing HTTP REST over WAN...');
    const httpClients = [];
    for (let i = 1; i <= CONCURRENCY; i++) httpClients.push(runHTTPClient(i));
    await Promise.all(httpClients);
    console.log(' HTTP WAN test complete.\n');

    // Brief pause between protocols
    await new Promise(r => setTimeout(r, 2000));

    // ── WebSocket phase ─────────────────────────────────────────────────
    console.log('[2/2] Testing WebSocket over WAN...');
    const wsClients = [];
    for (let i = 1; i <= CONCURRENCY; i++) wsClients.push(runWSClient(i));
    await Promise.all(wsClients);
    console.log(' WebSocket WAN test complete.\n');

    // ── Count outcomes ──────────────────────────────────────────────────
    const countErrors = (file) => {
        const content = fs.readFileSync(file, 'utf8');
        const lines   = content.split('\n').filter(l => l && !l.startsWith('Fase'));
        const errors  = lines.filter(l => l.includes('ERROR') || l.includes('TIMEOUT') || l.includes('DISCONNECT'));
        const steady  = lines.filter(l => l.startsWith('STEADY'));
        return { total: lines.length, steady: steady.length, errors: errors.length };
    };

    const httpStats = countErrors(CSV_HTTP);
    const wsStats   = countErrors(CSV_WS);

    console.log('══════════════════════════════════════════');
    console.log(' WAN EXPERIMENT COMPLETE');
    console.log('══════════════════════════════════════════');
    console.log(` HTTP: ${httpStats.steady} steady samples, ${httpStats.errors} errors`);
    console.log(` WS:   ${wsStats.steady} steady samples, ${wsStats.errors} errors`);
    console.log(` Output files: ${CSV_HTTP}, ${CSV_WS}`);
    console.log('');
    console.log(' Next step: run python3 analisis_wan.py to compare');
    console.log(' LAN-emulated vs WAN-real results.');
    console.log('══════════════════════════════════════════\n');

    process.exit(0);
}

runExperiment();
