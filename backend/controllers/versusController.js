const logger = require('../utils/logger');
const crypto = require('crypto');

// Memoria de salas versus: { roomId: { id, name, hostId, state, song, users: { userId: { socketId, id, name, avatar, score, combo, connected } } } }
const versusRooms = {};
const GRACE_PERIOD = 30000; // 30 segundos para reconectarse

const getPublicVersusRooms = () => {
    return Object.values(versusRooms).map(room => ({
        id: room.id,
        name: room.name,
        hostId: room.hostId,
        state: room.state, // 'waiting', 'playing', 'finished'
        userCount: Object.keys(room.users).length,
        maxUsers: 2
    }));
};

module.exports = (io) => {
    io.on('connection', (socket) => {
        
        // --- EVENTOS VERSUS LOBBY ---
        
        socket.on('join_versus_lobby', () => {
            socket.join('versus_lobby');
            socket.emit('versus_rooms_updated', getPublicVersusRooms());
        });

        socket.on('leave_versus_lobby', () => {
            socket.leave('versus_lobby');
        });

        // --- CREAR / UNIRSE A SALA VERSUS ---

        socket.on('create_versus_room', (data, callback) => {
            const { name, user } = data;
            const roomId = crypto.randomUUID();
            
            versusRooms[roomId] = {
                id: roomId,
                name,
                hostId: user.id,
                state: 'waiting',
                song: null,
                users: {
                    [user.id]: { ...user, socketId: socket.id, score: 0, combo: 0, connected: true }
                }
            };
            
            socket.join(roomId);
            socket.versusRoomId = roomId;
            socket.userId = user.id;

            io.to('versus_lobby').emit('versus_rooms_updated', getPublicVersusRooms());
            callback({ success: true, roomId, room: versusRooms[roomId] });
        });

        socket.on('join_versus_room', (data, callback) => {
            const { roomId, user } = data;
            const room = versusRooms[roomId];

            if (!room) {
                return callback({ success: false, message: 'La sala no existe' });
            }

            // Manejo de reconexión
            if (room.users[user.id]) {
                room.users[user.id].socketId = socket.id;
                room.users[user.id].connected = true;
                if (room.users[user.id].disconnectTimer) {
                    clearTimeout(room.users[user.id].disconnectTimer);
                    delete room.users[user.id].disconnectTimer;
                }
                
                socket.join(roomId);
                socket.versusRoomId = roomId;
                socket.userId = user.id;
                
                socket.to(roomId).emit('versus_user_reconnected', user.id);
                return callback({ success: true, room });
            }

            // Nueva conexión
            if (Object.keys(room.users).length >= 2) {
                return callback({ success: false, message: 'La sala está llena' });
            }

            if (room.state !== 'waiting') {
                return callback({ success: false, message: 'La partida ya está en curso' });
            }

            socket.join(roomId);
            socket.versusRoomId = roomId;
            socket.userId = user.id;

            room.users[user.id] = { ...user, socketId: socket.id, score: 0, combo: 0, connected: true };
            
            socket.to(roomId).emit('versus_user_joined', room.users[user.id]);
            io.to('versus_lobby').emit('versus_rooms_updated', getPublicVersusRooms());
            callback({ success: true, room });
        });

        // --- LÓGICA DE JUEGO VERSUS ---

        socket.on('versus_select_song', (song) => {
            if (socket.versusRoomId) {
                const room = versusRooms[socket.versusRoomId];
                if (room && room.hostId === socket.userId) {
                    room.song = song;
                    io.to(room.id).emit('versus_song_selected', song);
                }
            }
        });

        socket.on('versus_start_game', () => {
            if (socket.versusRoomId) {
                const room = versusRooms[socket.versusRoomId];
                if (room && room.hostId === socket.userId) {
                    room.state = 'playing';
                    // Reiniciar puntajes
                    Object.values(room.users).forEach(u => {
                        u.score = 0;
                        u.combo = 0;
                    });
                    
                    io.to(room.id).emit('versus_game_starting');
                    io.to('versus_lobby').emit('versus_rooms_updated', getPublicVersusRooms());
                }
            }
        });

        socket.on('versus_score_update', (data) => {
            if (socket.versusRoomId) {
                const room = versusRooms[socket.versusRoomId];
                if (room && room.users[socket.userId]) {
                    room.users[socket.userId].score = data.score;
                    room.users[socket.userId].combo = data.combo;
                    
                    // Retransmitir al oponente para la barra de Tira y Afloja
                    socket.to(room.id).emit('versus_opponent_score', {
                        userId: socket.userId,
                        score: data.score,
                        combo: data.combo,
                        hits: data.hits,
                        misses: data.misses
                    });
                }
            }
        });

        socket.on('versus_finish_game', () => {
            if (socket.versusRoomId) {
                const room = versusRooms[socket.versusRoomId];
                if (room) {
                    room.state = 'finished';
                    // No eliminamos la sala para que vean los resultados. Luego el host puede volver a waiting.
                    io.to('versus_lobby').emit('versus_rooms_updated', getPublicVersusRooms());
                }
            }
        });

        socket.on('versus_back_to_lobby', () => {
             if (socket.versusRoomId) {
                const room = versusRooms[socket.versusRoomId];
                if (room && room.hostId === socket.userId) {
                    room.state = 'waiting';
                    room.song = null;
                    io.to(room.id).emit('versus_reset_room');
                    io.to('versus_lobby').emit('versus_rooms_updated', getPublicVersusRooms());
                }
            }
        });

        // --- DESCONEXIÓN Y ABANDONO ---
        
        socket.on('leave_versus_room', () => {
            handleVersusDisconnect(socket, io, true);
        });

        socket.on('disconnect', () => {
            handleVersusDisconnect(socket, io, false);
        });

    });

    function handleVersusDisconnect(socket, io, intentional) {
        if (!socket.versusRoomId || !socket.userId) return;
        const roomId = socket.versusRoomId;
        const userId = socket.userId;
        const room = versusRooms[roomId];
        
        if (room && room.users[userId]) {
            if (intentional) {
                removeUserFromRoom(roomId, userId, io);
            } else {
                // Caída de conexión (Refresh). Dar tiempo de gracia.
                room.users[userId].connected = false;
                io.to(roomId).emit('versus_user_disconnected', userId);
                
                room.users[userId].disconnectTimer = setTimeout(() => {
                    removeUserFromRoom(roomId, userId, io);
                }, GRACE_PERIOD);
            }
        }
        
        socket.versusRoomId = null;
        socket.userId = null;
    }

    function removeUserFromRoom(roomId, userId, io) {
        const room = versusRooms[roomId];
        if (!room) return;
        
        if (room.users[userId]) {
            if (room.users[userId].disconnectTimer) clearTimeout(room.users[userId].disconnectTimer);
            delete room.users[userId];
        }

        io.to(roomId).emit('versus_user_left', userId);

        const remainingUsers = Object.values(room.users);
        if (remainingUsers.length === 0) {
            // Destruir sala si está vacía
            delete versusRooms[roomId];
        } else {
            // Reasignar Host si se fue el dueño
            if (room.hostId === userId) {
                room.hostId = remainingUsers[0].id;
                io.to(roomId).emit('versus_host_changed', room.hostId);
            }
        }
        
        io.to('versus_lobby').emit('versus_rooms_updated', getPublicVersusRooms());
    }
};
