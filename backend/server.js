const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');

const apiRoutes = require('./routes/api');
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');

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

// Manejador de errores centralizado
app.use(errorHandler);

const socketController = require('./controllers/socketController');
socketController(io);

// Arrancar el servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    logger.info(`Servidor PianoFlow Web (HTTP + WebSockets) corriendo en http://localhost:${PORT}`);
});
