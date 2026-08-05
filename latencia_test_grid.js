/**
 * latencia_test_grid.js
 * =====================
 * Parametrized latency test for the network condition grid experiment.
 * Network conditions (delay, loss) are applied externally via tc netem
 * by run_grid.sh before calling this script.
 *
 * Usage (called by run_grid.sh — do not run directly):
 *   node latencia_test_grid.js <SERVER_URL> <DELAY_MS> <LOSS_PCT> <OUT_PREFIX>
 *
 * Example:
 *   node latencia_test_grid.js https://pianoflowbackend.onrender.com 50 1 grid_d50_l1
 *
 * Output files:
 *   <OUT_PREFIX>_http.csv
 *   <OUT_PREFIX>_ws.csv
 */

const axios  = require('axios');
const io     = require('socket.io-client');
const fs     = require('fs');

// ── Args ──────────────────────────────────────────────────────────────────
const [,, SERVER_URL, DELAY_MS, LOSS_PCT, OUT_PREFIX] = process.argv;
if (!SERVER_URL || !DELAY_MS || !LOSS_PCT || !OUT_PREFIX) {
    console.error('Usage: node latencia_test_grid.js <SERVER_URL> <DELAY_MS> <LOSS_PCT> <OUT_PREFIX>');
    process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────
const CONCURRENCY           = 4;
const ITERATIONS_PER_CLIENT = 500;   // Reduced vs original (500 → 400 steady) for grid speed
const WARMUP_ITERATIONS     = 100;
const NOTES_PER_SECOND      = 25;
const INTERVAL_MS           = 1000 / NOTES_PER_SECOND;

const CSV_HTTP = `${OUT_PREFIX}_http.csv`;
const CSV_WS   = `${OUT_PREFIX}_ws.csv`;

console.log(`\n  Grid cell: delay=${DELAY_MS}ms  loss=${LOSS_PCT}%  prefix=${OUT_PREFIX}`);
console.log(`  Target: ${SERVER_URL}`);

fs.writeFileSync(CSV_HTTP, 'Fase,ClienteID,Iteracion,Latencia_ms,CPU_Load,RAM_MB,Status\n');
fs.writeFileSync(CSV_WS,   'Fase,ClienteID,Iteracion,Latencia_ms,CPU_Load,RAM_MB,Status\n');

// ── HTTP client ───────────────────────────────────────────────────────────
async function runHTTPClient(clientId) {
    let iteration = 0;
    return new Promise(resolve => {
        const timer = setInterval(async () => {
            if (iteration >= ITERATIONS_PER_CLIENT) { clearInterval(timer); resolve(); return; }
            iteration++;
            const start  = Date.now();
            const phase  = iteration <= WARMUP_ITERATIONS ? 'WARMUP' : 'STEADY';
            try {
                const res = await axios.post(`${SERVER_URL}/api/test/note`, { midi: 60 }, { timeout: 15000 });
                const rtt = Date.now() - start;
                fs.appendFileSync(CSV_HTTP, `${phase},${clientId},${iteration},${rtt},${res.data?.cpuLoad||0},${res.data?.ramMB||0},OK\n`);
            } catch (err) {
                const rtt    = Date.now() - start;
                const status = err.code === 'ECONNABORTED' ? 'TIMEOUT' : 'ERROR';
                fs.appendFileSync(CSV_HTTP, `${phase},${clientId},${iteration},${rtt},0,0,${status}\n`);
            }
        }, INTERVAL_MS);
    });
}

// ── WebSocket client ──────────────────────────────────────────────────────
function runWSClient(clientId) {
    return new Promise(resolve => {
        const socket = io(SERVER_URL, { transports: ['websocket'], timeout: 15000, reconnectionAttempts: 2 });
        let iteration = 0, dispatched = 0, timer = null;

        socket.on('connect', () => {
            timer = setInterval(() => {
                if (dispatched >= ITERATIONS_PER_CLIENT) { clearInterval(timer); return; }
                dispatched++;
                socket.emit('test_latencia_ws', { _testStart: Date.now(), _testIter: dispatched });
            }, INTERVAL_MS);
        });

        socket.on('test_latencia_ws_response', (data) => {
            const rtt   = Date.now() - data._testStart;
            const phase = data._testIter <= WARMUP_ITERATIONS ? 'WARMUP' : 'STEADY';
            iteration++;
            fs.appendFileSync(CSV_WS, `${phase},${clientId},${data._testIter},${rtt},${data.cpuLoad||0},${data.ramMB||0},OK\n`);
            if (iteration >= ITERATIONS_PER_CLIENT) { clearInterval(timer); socket.disconnect(); resolve(); }
        });

        socket.on('connect_error', (err) => {
            fs.appendFileSync(CSV_WS, `ERROR,${clientId},${dispatched},0,0,0,CONNECT_ERROR\n`);
        });

        socket.on('disconnect', () => {
            if (iteration < ITERATIONS_PER_CLIENT) {
                for (let i = iteration; i < ITERATIONS_PER_CLIENT; i++)
                    fs.appendFileSync(CSV_WS, `ERROR,${clientId},${i},0,0,0,DISCONNECT\n`);
                clearInterval(timer); resolve();
            }
        });
    });
}

// ── Orchestrator ──────────────────────────────────────────────────────────
async function run() {
    process.stdout.write('    HTTP... ');
    await Promise.all(Array.from({length: CONCURRENCY}, (_, i) => runHTTPClient(i+1)));
    console.log('done');

    await new Promise(r => setTimeout(r, 1500));

    process.stdout.write('    WS...   ');
    await Promise.all(Array.from({length: CONCURRENCY}, (_, i) => runWSClient(i+1)));
    console.log('done');

    process.exit(0);
}

run();
