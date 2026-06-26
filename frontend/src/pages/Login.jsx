import React, { useContext, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nombre, setNombre] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const res = await fetch(`http://${window.location.hostname}:3000/api/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ googleToken: credentialResponse.credential })
            });
            const data = await res.json();
            
            if (data.success) {
                login(data.user, data.token);
                navigate('/dashboard');
            } else {
                setErrorMsg(data.message || 'Error en autenticación');
            }
        } catch (error) {
            setErrorMsg('Fallo de conexión con backend.');
        }
    };

    const handleTraditionalAuth = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
        const payload = isRegistering ? { email, password, nombre } : { email, password };

        try {
            const res = await fetch(`http://${window.location.hostname}:3000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                if (isRegistering) {
                    setSuccessMsg(data.message);
                    setIsRegistering(false);
                    setPassword('');
                } else {
                    login(data.user, data.token);
                    navigate('/dashboard');
                }
            } else {
                setErrorMsg(data.message);
            }
        } catch (error) {
            setErrorMsg('Error de conexión con el servidor.');
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column' }}>
            <div className="system-panel" style={{ maxWidth: '400px', width: '100%' }}>
                
                {/* Header Amigable */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎹</div>
                    <h1 className="text-gradient" style={{ fontSize: '2rem', fontWeight: '700', margin: 0 }}>PianoFlow</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
                        {isRegistering ? 'Crea tu cuenta para empezar' : '¡Qué bueno verte de nuevo!'}
                    </p>
                </div>
                
                {errorMsg && <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid #ef4444', padding: '10px 14px', borderRadius: '4px', marginBottom: '1.5rem', fontSize: '0.9rem', color: '#fca5a5' }}>{errorMsg}</div>}
                {successMsg && <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeft: '3px solid #10b981', padding: '10px 14px', borderRadius: '4px', marginBottom: '1.5rem', fontSize: '0.9rem', color: '#6ee7b7' }}>{successMsg}</div>}

                {/* Formulario */}
                <form onSubmit={handleTraditionalAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginBottom: '2rem' }}>
                    {isRegistering && (
                        <div>
                            <input 
                                type="text" 
                                className="system-input"
                                placeholder="Tu nombre"
                                value={nombre} 
                                onChange={(e) => setNombre(e.target.value)}
                                required
                            />
                        </div>
                    )}
                    <div>
                        <input 
                            type="email" 
                            className="system-input"
                            placeholder="Correo electrónico"
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <input 
                            type="password" 
                            className="system-input"
                            placeholder="Contraseña"
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-system btn-accent" style={{ width: '100%', marginTop: '0.5rem', padding: '14px' }}>
                        {isRegistering ? 'Registrarme' : 'Entrar a tocar'}
                    </button>
                </form>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginBottom: '1.5rem', cursor: 'pointer' }} onClick={() => { setIsRegistering(!isRegistering); setErrorMsg(''); setSuccessMsg(''); }}>
                    <span style={{ fontWeight: '500' }}>
                        {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿Nuevo por aquí? Regístrate'}
                    </span>
                </p>

                <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
                    <span style={{ margin: '0 15px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>o entra con</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setErrorMsg('La autenticación con Google falló')}
                        theme="filled_black"
                        shape="pill"
                        size="large"
                    />
                </div>
            </div>
        </div>
    );
};

export default Login;
