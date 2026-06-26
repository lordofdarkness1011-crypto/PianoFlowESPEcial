import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Profile = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    if (!user) return null;

    const isPremium = user.tipo_suscripcion === 'premium' || user.tipo_suscripcion === 'institucional';

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <button 
                onClick={() => navigate('/dashboard')} 
                className="btn-system"
                style={{ marginBottom: '2rem' }}>
                ← Volver al Dashboard
            </button>

            <div className="system-panel" style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginBottom: '2rem' }}>
                <img 
                    src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.nombre}&background=3b82f6&color=fff&rounded=true`} 
                    alt="Avatar" 
                    style={{ width: '100px', height: '100px', borderRadius: '50%', border: '4px solid var(--accent-primary)' }} 
                />
                <div>
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem' }}>{user.nombre}</h1>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1.1rem' }}>{user.email}</p>
                </div>
            </div>

            <div className="system-panel" style={{ marginBottom: '2rem' }}>
                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: 'var(--text-muted)' }}>Suscripción Actual</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)', padding: '1rem', borderRadius: '8px' }}>
                    <div>
                        <span className="text-mono" style={{ fontSize: '1.2rem', fontWeight: '700', color: isPremium ? 'var(--accent-primary)' : 'var(--text-main)', textTransform: 'uppercase' }}>
                            {user.tipo_suscripcion}
                        </span>
                        <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            {isPremium ? 'Tienes acceso total a la nube y progreso guardado.' : 'Plan básico local. Tu progreso no se sincroniza en la nube.'}
                        </p>
                    </div>
                    {!isPremium && (
                        <button className="btn-system btn-accent">Mejorar a Premium</button>
                    )}
                </div>
            </div>

            <div className="system-panel">
                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: 'var(--text-muted)' }}>Nivel de Habilidad</h2>
                <select className="system-input" defaultValue={user.nivel_habilidad}>
                    <option value="principiante">Principiante (Guías visuales completas)</option>
                    <option value="intermedio">Intermedio (Guías parciales)</option>
                    <option value="avanzado">Avanzado (Sin guías visuales)</option>
                </select>
                <button className="btn-system" style={{ marginTop: '1rem', width: '100%', background: 'var(--accent-primary)', color: 'white' }}>Guardar Preferencias</button>
            </div>
        </div>
    );
};

export default Profile;
