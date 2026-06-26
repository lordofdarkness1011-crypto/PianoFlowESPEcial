import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Dashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    if (!user) return null;

    const defaultAvatar = `https://ui-avatars.com/api/?name=${user.nombre}&background=3b82f6&color=fff&rounded=true`;

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            
            {/* Top Bar Amigable */}
            <div className="system-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', padding: '1.5rem 2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', cursor: 'pointer' }} onClick={() => navigate('/profile')}>
                    <img 
                        src={user.avatar_url || defaultAvatar} 
                        alt="Avatar" 
                        style={{ width: '56px', height: '56px', borderRadius: '50%', border: '3px solid var(--accent-primary)', transition: 'transform 0.2s' }} 
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    />
                    <div>
                        <h1 style={{ fontSize: '1.5rem', margin: '0 0 4px 0', fontWeight: '700' }}>¡Hola, {user.nombre}!</h1>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>{user.email} (Ver Perfil)</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '20px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)' }}></div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--accent-green)', fontWeight: '600' }}>Conectado</span>
                    </div>
                    <button className="btn-system" onClick={handleLogout}>
                        Salir
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                
                {/* Stats Panel */}
                <div className="system-panel">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: '600', color: 'var(--text-muted)' }}>Tus Estadísticas</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)', padding: '12px 16px', borderRadius: '12px' }}>
                            <span style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Nivel</span>
                            <span className="text-mono" style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-primary)' }}>{user.nivel_habilidad}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)', padding: '12px 16px', borderRadius: '12px' }}>
                            <span style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Plan</span>
                            <span className="text-mono" style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-secondary)' }}>{user.tipo_suscripcion}</span>
                        </div>
                    </div>
                </div>

                {/* Hardware Panel */}
                <div className="system-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: '600', color: 'var(--text-muted)' }}>Conexión MIDI</h3>
                    
                    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'var(--bg-base)', borderRadius: '12px', padding: '1.5rem', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => navigate('/setup')} onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'} onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-base)'}>
                        <div style={{ fontSize: '2.5rem' }}>🎹</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, textAlign: 'center' }}>Configurar tu piano MIDI...</p>
                        <div style={{ padding: '6px 16px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontSize: '0.85rem', borderRadius: '20px', fontWeight: '500' }}>
                            Test de Latencia
                        </div>
                    </div>
                </div>
            </div>

            {/* Launch Action */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div className="system-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(14, 165, 233, 0.1))', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <div>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-main)' }}>Piano Virtual</h2>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Toca libremente en el sintetizador.</p>
                    </div>
                    <button 
                        className="btn-system btn-accent" 
                        onClick={() => navigate('/freeplay')}
                        style={{ padding: '10px 20px', borderRadius: '50px' }}
                    >
                        Juego Libre
                    </button>
                </div>
                
                <div className="system-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(52, 211, 153, 0.1))', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-main)' }}>Módulo Práctica</h2>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Aprende cayendo notas.</p>
                    </div>
                    <button 
                        className="btn-system" 
                        onClick={() => navigate('/dashboard/songs')}
                        style={{ background: '#10b981', color: 'white', padding: '10px 20px', borderRadius: '50px' }}
                    >
                        Aprender
                    </button>
                </div>

                <div className="system-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(124, 58, 237, 0.1))', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                    <div>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-main)' }}>Salas de Concierto</h2>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Toca con amigos en tiempo real.</p>
                    </div>
                    <button 
                        className="btn-system" 
                        onClick={() => navigate('/rooms')}
                        style={{ background: '#8b5cf6', color: 'white', padding: '10px 20px', borderRadius: '50px' }}
                    >
                        Multijugador
                    </button>
                </div>
            </div>
            
        </div>
    );
};

export default Dashboard;
