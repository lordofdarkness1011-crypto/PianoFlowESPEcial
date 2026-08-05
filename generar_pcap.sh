#!/bin/bash
echo "Iniciando captura de red (tcpdump)..."
SERVER_IP=$(getent hosts pianoflowbackend.onrender.com | awk '{ print $1 }' | head -1)
echo "Servidor resuelto a IP: $SERVER_IP"

# Iniciar tcpdump con sudo
sudo tcpdump -i any host $SERVER_IP -w evidencia_red.pcap &
TCPDUMP_PID=$!

echo "Capturando... ejecutando peticiones HTTP y WS de prueba..."
cat << 'JS_EOF' > pcap_traffic.js
const axios = require('axios');
const io = require('socket.io-client');
const url = 'https://pianoflowbackend.onrender.com';
(async () => {
    for(let i=0; i<5; i++) {
        await axios.post(url + '/api/test/note', {midi:60});
    }
    const socket = io(url, { transports: ['websocket'] });
    socket.on('connect', () => {
        for(let i=0; i<5; i++) {
            socket.emit('test_latencia_ws', {_testStart: Date.now(), _testIter: i});
        }
        setTimeout(() => { socket.disconnect(); process.exit(0); }, 1000);
    });
})();
JS_EOF

# Ejecutar node sin sudo usando la ruta del usuario normal
/home/royaliskluster/.nvm/versions/node/v24.16.0/bin/node pcap_traffic.js
sleep 2

sudo kill $TCPDUMP_PID
rm pcap_traffic.js
echo "Captura completada. Archivo guardado como: evidencia_red.pcap"
