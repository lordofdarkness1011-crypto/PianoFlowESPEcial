const logger = require('../utils/logger');
const crypto = require('crypto');

// Memoria de salas: { roomId: { id, name, isPrivate, password, users: { socketId: { ...user } } } }
const rooms = {};

const getPublicRooms = () => {
    return Object.values(rooms).map(room => ({
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        userCount: Object.keys(room.users).length
    }));
};

module.exports = (io) => {
    io.on('connection', (socket) => {
        logger.info(`[Socket.io] Nueva conexión establecida. ID: ${socket.id}`);

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

        socket.on('disconnect', () => {
            leaveCurrentRoom(socket, io);
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
