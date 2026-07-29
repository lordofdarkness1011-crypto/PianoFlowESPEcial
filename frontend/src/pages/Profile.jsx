import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PremiumUpgrade from '../components/PremiumUpgrade';
import AdminPanel from '../components/AdminPanel';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const Profile = () => {
    const { user, token } = useContext(AuthContext);
    const navigate = useNavigate();

    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [qrCode, setQrCode] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [mfaError, setMfaError] = useState('');
    const [mfaSuccess, setMfaSuccess] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    
    // AuthContext needs login to update the token/user globally
    const { login } = useContext(AuthContext);
    useEffect(() => {
        if (user && user.email) {
            fetch(`${API_URL}/api/mfa/status/${user.email}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.user) {
                        setMfaEnabled(data.user.mfaEnabled);
                    }
                })
                .catch(err => console.error("Error fetching MFA status", err));
        }
    }, [user]);

    const handleSetupMfa = async () => {
        setMfaError('');
        setMfaSuccess('');
        try {
            const res = await fetch(`${API_URL}/api/mfa/setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email })
            });
            const data = await res.json();
            if (data.success) {
                setQrCode(data.qrCode);
            } else {
                setMfaError(data.message);
            }
        } catch (err) {
            setMfaError('Error configurando MFA');
        }
    };

    const handleConfirmMfa = async () => {
        setMfaError('');
        setMfaSuccess('');
        try {
            const res = await fetch(`${API_URL}/api/mfa/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, code: mfaCode })
            });
            const data = await res.json();
            if (data.success) {
                setMfaEnabled(true);
                setQrCode('');
                setMfaSuccess('Autenticación de dos pasos activada correctamente.');
            } else {
                setMfaError(data.message);
            }
        } catch (err) {
            setMfaError('Error confirmando MFA');
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        setUploadingAvatar(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                // Update global auth context
                if (login) {
                    login(data.user, data.token);
                }
            } else {
                alert(data.message || 'Error al subir la imagen');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            alert('Hubo un error al subir la imagen');
        } finally {
            setUploadingAvatar(false);
        }
    };

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
                <div style={{ position: 'relative' }}>
                    <img 
                        src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.nombre}&background=3b82f6&color=fff&rounded=true`} 
                        alt="Avatar" 
                        style={{ width: '100px', height: '100px', borderRadius: '50%', border: '4px solid var(--accent-primary)', objectFit: 'cover', opacity: uploadingAvatar ? 0.5 : 1 }} 
                    />
                    <label style={{ position: 'absolute', bottom: '-10px', right: '-10px', background: 'var(--accent-primary)', color: 'white', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>
                        <span style={{ fontSize: '1.2rem' }}>📷</span>
                        <input type="file" accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} disabled={uploadingAvatar} />
                    </label>
                </div>
                <div>
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem' }}>{user.nombre}</h1>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1.1rem' }}>{user.email}</p>
                    {uploadingAvatar && <p style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Subiendo imagen...</p>}
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
                        {isPremium && user.premium_expires_at && (
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
                                Válido hasta: {new Date(user.premium_expires_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        )}
                    </div>
                    {!isPremium && (
                        <button className="btn-system btn-accent" onClick={() => document.getElementById('premium-section').scrollIntoView({ behavior: 'smooth' })}>Mejorar a Premium</button>
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

            <div className="system-panel">
                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: 'var(--text-muted)' }}>Seguridad</h2>
                
                <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontWeight: '600' }}>Autenticación en dos pasos (MFA)</span>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                {mfaEnabled ? 'Activada' : 'Desactivada'}
                            </p>
                        </div>
                        {!mfaEnabled && !qrCode && (
                            <button className="btn-system" onClick={handleSetupMfa}>Activar 2FA</button>
                        )}
                    </div>

                    {mfaError && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{mfaError}</p>}
                    {mfaSuccess && <p style={{ color: '#10b981', marginTop: '1rem' }}>{mfaSuccess}</p>}

                    {qrCode && (
                        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', padding: '1rem', borderRadius: '8px', color: '#000' }}>
                            <p style={{ fontWeight: 'bold' }}>Escanea este código con Microsoft o Google Authenticator:</p>
                            <img src={qrCode} alt="QR Code MFA" style={{ width: '200px', height: '200px' }} />
                            <div style={{ marginTop: '1rem', width: '100%', display: 'flex', gap: '10px' }}>
                                <input 
                                    type="text" 
                                    className="system-input" 
                                    style={{ flex: 1, border: '1px solid #ccc', color: '#000' }}
                                    placeholder="Ingresa el código de 6 dígitos"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
                                />
                                <button className="btn-system btn-accent" onClick={handleConfirmMfa}>Confirmar</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div id="premium-section" style={{ marginTop: '2rem' }}>
                <PremiumUpgrade />
            </div>

            {user.rol === 'admin' && (
                <div id="admin-section" style={{ marginTop: '2rem' }}>
                    <AdminPanel />
                </div>
            )}
        </div>
    );
};

export default Profile;
