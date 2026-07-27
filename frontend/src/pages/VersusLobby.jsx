import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

const VersusLobby = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [newRoomName, setNewRoomName] = useState('');
    const [socket, setSocket] = useState(null);
    
    const isPremium = user?.tipo_suscripcion === 'premium' || user?.tipo_suscripcion === 'institucional';

    useEffect(() => {
        if (!isPremium) return;

        const newSocket = io(API_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            newSocket.emit('join_versus_lobby');
        });

        newSocket.on('versus_rooms_updated', (updatedRooms) => {
            setRooms(updatedRooms);
        });

        return () => {
            newSocket.emit('leave_versus_lobby');
            newSocket.disconnect();
        };
    }, [isPremium]);

    if (!isPremium) {
        return (
            <div className="system-panel" style={{ textAlign: 'center', marginTop: '4rem' }}>
                <h2 style={{ color: '#ef4444' }}>Acceso Denegado 🔒</h2>
                <p style={{ marginTop: '1rem', color: '#94a3b8' }}>
                    El módulo experimental Versus es exclusivo para usuarios Premium.
                </p>
                <button 
                    className="btn-system mt-4"
                    onClick={() => navigate('/profile')}
                >
                    Mejorar a Premium
                </button>
            </div>
        );
    }

    const handleCreateRoom = (e) => {
        e.preventDefault();
        if (!newRoomName.trim() || !socket) return;

        socket.emit('create_versus_room', { name: newRoomName.trim(), user }, (response) => {
            if (response.success) {
                navigate(`/versus/${response.roomId}`);
            } else {
                alert('Error al crear sala');
            }
        });
    };

    const handleJoinRoom = (roomId) => {
        navigate(`/versus/${roomId}`);
    };

    return (
        <div className="system-panel" style={{ marginTop: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <button 
                    className="btn-system" 
                    onClick={() => navigate('/dashboard')}
                    style={{ 
                        background: 'transparent', 
                        border: '1px solid #334155', 
                        color: '#94a3b8',
                        padding: '6px 12px',
                        fontSize: '0.9rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '1rem'
                    }}
                >
                    ← Volver al Dashboard
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
                    <div>
                        <h2 style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            ⚔️ Versus Mode <span style={{ fontSize: '0.6em', background: '#eab308', color: '#000', padding: '2px 6px', borderRadius: '4px' }}>EXPERIMENTAL</span>
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                            Enfréntate a otros pianistas en tiempo real (Clon Osu!mania - 4 Teclas D,F,J,K).
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
                <div>
                    <h3 style={{ color: '#cbd5e1', marginBottom: '1rem' }}>Salas Activas</h3>
                    {rooms.length === 0 ? (
                        <div style={{ background: '#0f172a', padding: '2rem', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
                            No hay salas disponibles. ¡Crea una nueva!
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {rooms.map(room => (
                                <div key={room.id} style={{ 
                                    background: '#0f172a', 
                                    padding: '1rem', 
                                    borderRadius: '8px', 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    border: '1px solid #1e293b'
                                }}>
                                    <div>
                                        <h4 style={{ color: '#e2e8f0', margin: 0 }}>{room.name}</h4>
                                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                                            {room.state === 'waiting' ? '🟢 Esperando...' : room.state === 'playing' ? '🔴 En Partida' : '⚪ Finalizado'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <span style={{ color: '#3b82f6', fontSize: '0.9rem' }}>{room.userCount}/2</span>
                                        <button 
                                            className="btn-system"
                                            onClick={() => handleJoinRoom(room.id)}
                                            disabled={room.userCount >= 2 && room.state === 'waiting'} // Allow reconnect if playing, will be validated by backend
                                            style={{ 
                                                padding: '6px 12px', 
                                                fontSize: '0.9rem',
                                                background: room.userCount >= 2 ? '#334155' : '#10b981',
                                                color: room.userCount >= 2 ? '#94a3b8' : 'white',
                                                borderColor: 'transparent'
                                            }}
                                        >
                                            {room.userCount >= 2 ? 'Lleno' : 'Unirse'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
                        <h3 style={{ color: '#cbd5e1', marginBottom: '1rem', fontSize: '1.1rem' }}>Crear Sala</h3>
                        <form onSubmit={handleCreateRoom}>
                            <div className="form-group">
                                <label style={{ color: '#94a3b8' }}>Nombre de la Sala</label>
                                <input 
                                    type="text" 
                                    className="form-control"
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    placeholder="Ej: Duelo Épico"
                                    maxLength={30}
                                    required
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: 'white' }}
                                />
                            </div>
                            <button type="submit" className="btn-system" style={{ width: '100%', marginTop: '1rem' }}>
                                Crear y Entrar
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VersusLobby;
