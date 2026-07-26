import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import io from 'socket.io-client';
import VersusEngine from '../components/VersusEngine';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

// Mock de canciones, usando los midis reales existentes en el sistema
const availableSongs = [
    { id: 1, title: 'The Unforgiven', artist: 'Metallica', difficulty: 'Normal', file: '/songs/theunforgiven.mid' },
    { id: 2, title: 'Escala 3 Octavas', artist: 'Práctica', difficulty: 'Fácil', file: '/songs/escala_3oct.mid' },
    { id: 3, title: 'Rango 5 Octavas', artist: 'Práctica', difficulty: 'Difícil', file: '/songs/rango_5oct.mid' }
];

const VersusRoom = () => {
    const { roomId } = useParams();
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [socket, setSocket] = useState(null);
    const [roomState, setRoomState] = useState(null); // { id, name, hostId, state, song, users: {} }
    const [selectedSong, setSelectedSong] = useState(availableSongs[0]);
    const [error, setError] = useState('');
    const [gameStarting, setGameStarting] = useState(false);

    const isPremium = user?.tipo_suscripcion === 'premium' || user?.tipo_suscripcion === 'institucional';

    useEffect(() => {
        if (!isPremium) {
            navigate('/versus');
            return;
        }

        const newSocket = io(API_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            newSocket.emit('join_versus_room', { roomId, user }, (response) => {
                if (response.success) {
                    setRoomState(response.room);
                    if (response.room.song) {
                        setSelectedSong(response.room.song);
                    }
                } else {
                    setError(response.message);
                }
            });
        });

        newSocket.on('versus_user_joined', (newUser) => {
            setRoomState(prev => {
                if (!prev) return prev;
                return { ...prev, users: { ...prev.users, [newUser.id]: newUser } };
            });
        });

        newSocket.on('versus_user_reconnected', (userId) => {
            setRoomState(prev => {
                if (!prev || !prev.users[userId]) return prev;
                return { 
                    ...prev, 
                    users: { 
                        ...prev.users, 
                        [userId]: { ...prev.users[userId], connected: true } 
                    } 
                };
            });
        });

        newSocket.on('versus_user_disconnected', (userId) => {
            setRoomState(prev => {
                if (!prev || !prev.users[userId]) return prev;
                return { 
                    ...prev, 
                    users: { 
                        ...prev.users, 
                        [userId]: { ...prev.users[userId], connected: false } 
                    } 
                };
            });
        });

        newSocket.on('versus_user_left', (userId) => {
            setRoomState(prev => {
                if (!prev) return prev;
                const newUsers = { ...prev.users };
                delete newUsers[userId];
                return { ...prev, users: newUsers };
            });
        });

        newSocket.on('versus_host_changed', (newHostId) => {
            setRoomState(prev => {
                if (!prev) return prev;
                return { ...prev, hostId: newHostId };
            });
        });

        newSocket.on('versus_song_selected', (song) => {
            setSelectedSong(song);
            setRoomState(prev => ({ ...prev, song }));
        });

        newSocket.on('versus_game_starting', () => {
            setRoomState(prev => ({ ...prev, state: 'playing' }));
            setGameStarting(true);
        });
        
        newSocket.on('versus_reset_room', () => {
            setRoomState(prev => ({ ...prev, state: 'waiting', song: null }));
            setGameStarting(false);
        });

        return () => {
            newSocket.emit('leave_versus_room');
            newSocket.disconnect();
        };
    }, [roomId, user, isPremium, navigate]);

    if (error) {
        return (
            <div className="system-panel" style={{ textAlign: 'center', marginTop: '4rem' }}>
                <h2 style={{ color: '#ef4444' }}>Error ❌</h2>
                <p style={{ marginTop: '1rem', color: '#94a3b8' }}>{error}</p>
                <button className="btn-system mt-4" onClick={() => navigate('/versus')}>Volver al Lobby</button>
            </div>
        );
    }

    if (!roomState) {
        return <div style={{ textAlign: 'center', marginTop: '4rem', color: '#94a3b8' }}>Conectando a la sala...</div>;
    }

    const isHost = roomState.hostId === user.id;
    const usersList = Object.values(roomState.users);
    const opponent = usersList.find(u => u.id !== user.id);

    const handleSongChange = (e) => {
        const songId = parseInt(e.target.value);
        const song = availableSongs.find(s => s.id === songId);
        setSelectedSong(song);
        socket.emit('versus_select_song', song);
    };

    const handleStartGame = () => {
        if (usersList.length < 2) {
            alert('Falta un jugador para iniciar.');
            return;
        }
        socket.emit('versus_start_game');
    };

    if (roomState.state === 'playing' || roomState.state === 'finished') {
        return (
            <VersusEngine 
                socket={socket} 
                roomState={roomState}
                song={selectedSong}
                user={user}
                opponent={opponent}
                isHost={isHost}
            />
        );
    }

    return (
        <div className="system-panel" style={{ marginTop: '2rem', maxWidth: '800px', margin: '2rem auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
                <h2 style={{ color: '#e2e8f0', margin: 0 }}>Sala: <span style={{ color: '#3b82f6' }}>{roomState.name}</span></h2>
                <button 
                    className="btn-system"
                    style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }}
                    onClick={() => navigate('/versus')}
                >
                    Abandonar Sala
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Panel Jugadores */}
                <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <h3 style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '1.1rem' }}>Jugadores ({usersList.length}/2)</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {usersList.map(u => (
                            <div key={u.id} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '1rem',
                                padding: '10px',
                                background: '#1e293b',
                                borderRadius: '6px',
                                borderLeft: u.id === roomState.hostId ? '4px solid #eab308' : '4px solid #3b82f6',
                                opacity: u.connected ? 1 : 0.5
                            }}>
                                <img src={u.avatar_url || 'https://via.placeholder.com/40'} alt={u.nombre} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                                <div>
                                    <div style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{u.nombre} {u.id === user.id ? '(Tú)' : ''}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                        {u.id === roomState.hostId ? '👑 Anfitrión' : '👤 Invitado'}
                                        {!u.connected && ' ⚠️ Desconectado'}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {usersList.length < 2 && (
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                padding: '20px',
                                background: 'rgba(30, 41, 59, 0.5)',
                                borderRadius: '6px',
                                border: '1px dashed #334155',
                                color: '#64748b'
                            }}>
                                Esperando al oponente...
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel Controles */}
                <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '1.1rem' }}>Configuración</h3>
                    
                    <div style={{ flex: 1 }}>
                        <label style={{ color: '#64748b', fontSize: '0.9rem' }}>Canción Seleccionada</label>
                        {isHost ? (
                            <select 
                                className="form-control" 
                                style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', marginTop: '0.5rem' }}
                                value={selectedSong.id}
                                onChange={handleSongChange}
                            >
                                {availableSongs.map(s => (
                                    <option key={s.id} value={s.id}>{s.title} - {s.artist} ({s.difficulty})</option>
                                ))}
                            </select>
                        ) : (
                            <div style={{ 
                                padding: '10px', 
                                background: '#1e293b', 
                                borderRadius: '4px', 
                                marginTop: '0.5rem',
                                color: '#e2e8f0'
                            }}>
                                {selectedSong ? `${selectedSong.title} - ${selectedSong.artist}` : 'El anfitrión está eligiendo...'}
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '2rem' }}>
                        {isHost ? (
                            <button 
                                className="btn-system" 
                                style={{ width: '100%', background: '#10b981', borderColor: '#10b981', padding: '12px' }}
                                onClick={handleStartGame}
                                disabled={usersList.length < 2}
                            >
                                INICIAR VERSUS
                            </button>
                        ) : (
                            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '10px' }}>
                                Esperando a que el anfitrión inicie...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VersusRoom;
