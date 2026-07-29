const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/adminRoutes');
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');
const worker = require('./worker');

require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configuración de Socket.io (Tiempo Real)
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Rutas API REST
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// Manejador de errores centralizado
app.use(errorHandler);

const socketController = require('./controllers/socketController');
const versusController = require('./controllers/versusController');
socketController(io);
versusController(io);

// Arrancar el servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    logger.info(`Servidor PianoFlow Web (HTTP + WebSockets) corriendo en http://localhost:${PORT}`);
    
    // Iniciar el worker de la cola (para envío de correos OTP en background)
    worker.start();
});
