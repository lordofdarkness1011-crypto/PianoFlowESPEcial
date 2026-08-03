const axios = require('axios');
const io = require('socket.io-client');
const fs = require('fs');

// ==========================================
// SCIENTIFIC RIGOR CONFIGURATION
// ==========================================
const SERVER_URL = 'http://localhost:3000'; // Change this to your Linux IP (e.g., http://192.168.1.55:3000)

const CONCURRENCY = 4; // Simultaneous players hitting the server at the same time
const ITERATIONS_PER_CLIENT = 1000;
const WARMUP_ITERATIONS = 100; // Discard the first 10% (Warm-up phase)

// Load: 25 notes per player * 4 players = 100 requests per second total to the server
const NOTES_PER_SECOND_PER_CLIENT = 25;
const INTERVAL_MS = 1000 / NOTES_PER_SECOND_PER_CLIENT;

const CSV_HTTP = 'resultados_latencia_http.csv';
const CSV_WS = 'resultados_latencia_ws.csv';

fs.writeFileSync(CSV_HTTP, 'Phase,ClientID,Iteration,Latency_ms,CPU_Load,RAM_MB,Status\n');
fs.writeFileSync(CSV_WS, 'Phase,ClientID,Iteration,Latency_ms,CPU_Load,RAM_MB,Status\n');

// ==========================================
// 1. HTTP CLIENT (REST)
// ==========================================
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
            const start = Date.now();
            const isWarmup = iteration <= WARMUP_ITERATIONS;
            const phase = isWarmup ? 'WARMUP' : 'STEADY';
            const numIter = iteration;

            try {
                const response = await axios.post(`${SERVER_URL}/api/test/note`, { midi: 60 });
                const rtt = Date.now() - start;
                const cpu = response.data.cpuLoad || 0;
                const ram = response.data.ramMB || 0;

                fs.appendFileSync(CSV_HTTP, `${phase},${clientId},${numIter},${rtt},${cpu},${ram},OK\n`);
            } catch (error) {
                fs.appendFileSync(CSV_HTTP, `${phase},${clientId},${numIter},ERROR,0,0,TIMEOUT\n`);
            }
        }, INTERVAL_MS);
    });
}

// ==========================================
// 2. WEBSOCKETS CLIENT
// ==========================================
function runWSClient(clientId) {
    return new Promise(resolve => {
        const socket = io(SERVER_URL, { transports: ['websocket'] });
        let iteration = 0;
        let requestsDispatched = 0;

        socket.on('connect', () => {
            const timer = setInterval(() => {
                if (requestsDispatched >= ITERATIONS_PER_CLIENT) {
                    clearInterval(timer);
                    return;
                }

                requestsDispatched++;
                const start = Date.now();
                socket.emit('test_latencia_ws', { _testStart: start, _testIter: requestsDispatched });
            }, INTERVAL_MS);
        });

        socket.on('test_latencia_ws_response', (data) => {
            const rtt = Date.now() - data._testStart;
            iteration++;

            const isWarmup = data._testIter <= WARMUP_ITERATIONS;
            const phase = isWarmup ? 'WARMUP' : 'STEADY';

            fs.appendFileSync(CSV_WS, `${phase},${clientId},${data._testIter},${rtt},${data.cpuLoad || 0},${data.ramMB || 0},OK\n`);

            if (iteration >= ITERATIONS_PER_CLIENT) {
                socket.disconnect();
                resolve();
            }
        });

        socket.on('connect_error', () => {
            fs.appendFileSync(CSV_WS, `ERROR,${clientId},${iteration},0,0,0,TIMEOUT\n`);
        });
    });
}

// ==========================================
// ORCHESTRATOR
// ==========================================
async function runExperiment() {
    console.log(`\n STARTING RIGOROUS EXPERIMENT (${CONCURRENCY} Concurrent Clients)\n`);

    // HTTP
    console.log(`[1/2] Hitting server with HTTP REST...`);
    const httpClients = [];
    for (let i = 1; i <= CONCURRENCY; i++) httpClients.push(runHTTPClient(i));
    await Promise.all(httpClients);
    console.log(` HTTP Test Completed.`);

    // WEBSOCKETS
    console.log(`\n[2/2] Hitting server with WEBSOCKETS...`);
    const wsClients = [];
    for (let i = 1; i <= CONCURRENCY; i++) wsClients.push(runWSClient(i));
    await Promise.all(wsClients);
    console.log(` WebSockets Test Completed.`);

    console.log("\n EXPERIMENT COMPLETE. CSV files ready for T-Test analysis.");
    process.exit(0);
}

runExperiment();
