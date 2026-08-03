const logger = require('../utils/logger');
const crypto = require('crypto');

// Memoria de salas: { roomId: { id, name, isPrivate, password, users: { socketId: { ...user } } } }
const rooms = {};

// Memoria de sesiones globales: { userId: { socketId, deviceId } }
const activeSessions = {};

const getPublicRooms = () => {
    return Object.values(rooms).map(room => ({
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        userCount: Object.keys(room.users).length
    }));
};

const os = require('os');
module.exports = (io) => {
    io.on('connection', (socket) => {
        logger.info(`[Socket.io] Nueva conexión establecida. ID: ${socket.id}`);

        // REGISTRO DE SESIÓN GLOBAL (Control de Dispositivos)
        socket.on('register_session', (data) => {
            const { userId, deviceId } = data;
            
            if (activeSessions[userId]) {
                const oldSession = activeSessions[userId];
                
                // Si existe otra sesión y el deviceId es distinto, forzamos cierre de sesión al viejo
                if (oldSession.deviceId !== deviceId) {
                    logger.info(`[Session] Usuario ${userId} inició sesión en otro dispositivo. Desconectando socket anterior: ${oldSession.socketId}`);
                    io.to(oldSession.socketId).emit('force_logout', 'Has iniciado sesión en otro dispositivo. Esta sesión se cerrará.');
                }
            }
            
            // Actualizamos la sesión activa con el nuevo socket y dispositivo
            activeSessions[userId] = {
                socketId: socket.id,
                deviceId: deviceId
            };
            
            socket.userId = userId; // Lo guardamos en el socket para limpieza al desconectar
        });

        // Enviar salas activas al conectarse
        socket.emit('rooms_updated', getPublicRooms());

        socket.on('create_room', (data, callback) => {
            const { name, isPrivate, password, user } = data;
            const roomId = crypto.randomUUID();
            
            rooms[roomId] = {
                id: roomId,
                name,
                isPrivate,
                password: isPrivate ? password : null,
                users: {}
            };
            
            // Unir al creador inmediatamente
            socket.join(roomId);
            rooms[roomId].users[socket.id] = { ...user, socketId: socket.id };
            socket.roomId = roomId;

            io.emit('rooms_updated', getPublicRooms());
            callback({ success: true, roomId, users: [rooms[roomId].users[socket.id]] });
        });

        socket.on('join_room', (data, callback) => {
            const { roomId, password, user } = data;
            const room = rooms[roomId];

            if (!room) {
                return callback({ success: false, message: 'La sala no existe' });
            }

            if (Object.keys(room.users).length >= 4) {
                return callback({ success: false, message: 'La sala está llena (máximo 4 personas)' });
            }

            if (room.isPrivate && room.password !== password) {
                return callback({ success: false, message: 'Contraseña incorrecta' });
            }

            // Dejar sala actual si está en una
            if (socket.roomId && rooms[socket.roomId]) {
                leaveCurrentRoom(socket, io);
            }

            socket.join(roomId);
            room.users[socket.id] = { ...user, socketId: socket.id };
            socket.roomId = roomId;

            // Avisar a la sala
            socket.to(roomId).emit('user_joined', room.users[socket.id]);
            // Enviar lista actual al recién llegado
            callback({ success: true, room: { id: room.id, name: room.name }, users: Object.values(room.users) });
            io.emit('rooms_updated', getPublicRooms());
        });

        socket.on('leave_room', () => {
            leaveCurrentRoom(socket, io);
        });

        socket.on('play_note', (data) => {
            if (socket.roomId) {
                socket.to(socket.roomId).emit('user_played_note', {
                    socketId: socket.id,
                    note: data.note,
                    velocity: data.velocity,
                    instrument: data.instrument,
                    type: 'NOTE_ON'
                });
            }
        });

        socket.on('stop_note', (data) => {
            if (socket.roomId) {
                socket.to(socket.roomId).emit('user_played_note', {
                    socketId: socket.id,
                    note: data.note,
                    instrument: data.instrument,
                    type: 'NOTE_OFF'
                });
            }
        });

        socket.on('change_instrument', (instrument) => {
            if (socket.roomId) {
                const room = rooms[socket.roomId];
                if (room && room.users[socket.id]) {
                    room.users[socket.id].instrument = instrument;
                }
                socket.to(socket.roomId).emit('user_changed_instrument', {
                    socketId: socket.id,
                    instrument
                });
            }
        });

        // Evento especial para medir latencia (Experimento Artículo Springer)
        socket.on('test_latencia_ws', (data) => {
            socket.emit('test_latencia_ws_response', {
                ...data,
                serverTime: Date.now(),
                cpuLoad: os.loadavg()[0],
                ramMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
            });
        });

        socket.on('disconnect', () => {
            leaveCurrentRoom(socket, io);
            
            // Limpiar sesión global si este socket era el activo
            if (socket.userId && activeSessions[socket.userId]?.socketId === socket.id) {
                delete activeSessions[socket.userId];
            }
            
            logger.info(`[Socket.io] Conexión cerrada. ID: ${socket.id}`);
        });
    });

    function leaveCurrentRoom(socket, io) {
        if (!socket.roomId) return;
        const roomId = socket.roomId;
        const room = rooms[roomId];
        
        if (room) {
            socket.leave(roomId);
            delete room.users[socket.id];
            
            // Avisar a los demás
            socket.to(roomId).emit('user_left', socket.id);

            // Borrar sala si quedó vacía
            if (Object.keys(room.users).length === 0) {
                delete rooms[roomId];
            }
            io.emit('rooms_updated', getPublicRooms());
        }
        socket.roomId = null;
    }
};
