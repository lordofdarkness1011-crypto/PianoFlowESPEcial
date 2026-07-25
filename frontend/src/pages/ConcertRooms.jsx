import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../utils/socket';
import { AuthContext } from '../context/AuthContext';
import PremiumUpgrade from '../components/PremiumUpgrade';

const ConcertRooms = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const [rooms, setRooms] = useState([]);
    
    // Modales
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(null); // Contiene el objeto room si se requiere password
    
    // Formulario Crear
    const [roomName, setRoomName] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [password, setPassword] = useState('');
    
    // Formulario Unirse
    const [joinPassword, setJoinPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const isFreemium = user?.tipo_suscripcion === 'freemium';

    useEffect(() => {
        if (!socket.connected) {
            socket.connect();
        }
        
        socket.on('rooms_updated', (data) => {
            setRooms(data);
        });

        return () => {
            socket.off('rooms_updated');
        };
    }, []);

    const handleCreateRoom = (e) => {
        e.preventDefault();
        if (!roomName.trim()) return;

        socket.emit('create_room', { name: roomName, isPrivate, password, user }, (response) => {
            if (response.success) {
                navigate(`/rooms/${response.roomId}`, { state: { roomName: roomName, users: response.users } });
            }
        });
    };

    const attemptJoinRoom = (room, pwd = null) => {
        setErrorMsg('');
        socket.emit('join_room', { roomId: room.id, password: pwd, user }, (response) => {
            if (response.success) {
                navigate(`/rooms/${room.id}`, { state: { roomName: room.name, users: response.users } });
            } else {
                setErrorMsg(response.message || 'Error al unirse a la sala');
                if (room.isPrivate && !showJoinModal) {
                    setShowJoinModal(room);
                }
            }
        });
    };

    const handleJoinClick = (room) => {
        if (room.isPrivate) {
            setShowJoinModal(room);
            setJoinPassword('');
            setErrorMsg('');
        } else {
            attemptJoinRoom(room);
        }
    };

    const submitJoinPassword = (e) => {
        e.preventDefault();
        attemptJoinRoom(showJoinModal, joinPassword);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button onClick={() => navigate('/dashboard')} className="btn-system">← Volver</button>
                <button 
                    onClick={() => setShowCreateModal(true)} 
                    className="btn-system btn-accent"
                    disabled={isFreemium}
                    style={isFreemium ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                    ➕ Crear Sala
                </button>
            </div>

            <h1 style={{ marginBottom: '2rem' }}>Salas de Concierto Multijugador</h1>

            {isFreemium && (
                <div style={{ marginBottom: '2rem' }}>
                    <PremiumUpgrade />
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {rooms.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)' }}>No hay salas activas. ¡Crea la primera!</div>
                ) : (
                    rooms.map(room => (
                        <div key={room.id} className="system-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>
                                    {room.isPrivate && '🔒 '}
                                    {room.name}
                                </h3>
                                <span style={{ background: 'var(--bg-base)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem', color: room.userCount >= 4 ? '#ef4444' : 'inherit' }}>
                                    👥 {room.userCount}/4
                                </span>
                            </div>
                            <button 
                                className="btn-system" 
                                onClick={() => handleJoinClick(room)}
                                disabled={room.userCount >= 4 || isFreemium}
                                style={(room.userCount >= 4 || isFreemium) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                                {room.userCount >= 4 ? 'Sala Llena' : 'Unirse a la sala'}
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Crear Sala */}
            {showCreateModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="system-panel" style={{ width: '400px', maxWidth: '90%' }}>
                        <h2>Crear Nueva Sala</h2>
                        <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                            <input 
                                className="system-input" 
                                placeholder="Nombre de la sala" 
                                value={roomName} 
                                onChange={(e) => setRoomName(e.target.value)} 
                                required 
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={isPrivate} 
                                    onChange={(e) => setIsPrivate(e.target.checked)} 
                                />
                                Sala Privada (Requiere contraseña)
                            </label>
                            {isPrivate && (
                                <input 
                                    className="system-input" 
                                    type="password"
                                    placeholder="Contraseña" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    required 
                                />
                            )}
                            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                                <button type="button" className="btn-system" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-system btn-accent" style={{ flex: 1 }}>Crear</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Unirse a Sala Privada */}
            {showJoinModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="system-panel" style={{ width: '400px', maxWidth: '90%' }}>
                        <h2>Sala Privada: {showJoinModal.name}</h2>
                        {errorMsg && <p style={{ color: '#ef4444' }}>{errorMsg}</p>}
                        <form onSubmit={submitJoinPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                            <input 
                                className="system-input" 
                                type="password"
                                placeholder="Contraseña de la sala" 
                                value={joinPassword} 
                                onChange={(e) => setJoinPassword(e.target.value)} 
                                required 
                            />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                                <button type="button" className="btn-system" style={{ flex: 1 }} onClick={() => setShowJoinModal(null)}>Cancelar</button>
                                <button type="submit" className="btn-system btn-accent" style={{ flex: 1 }}>Entrar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConcertRooms;
