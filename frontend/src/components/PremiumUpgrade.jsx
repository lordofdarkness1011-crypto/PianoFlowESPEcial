import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PremiumUpgrade = () => {
    const { token, user, login } = useContext(AuthContext);
    const isPremium = user?.tipo_suscripcion === 'premium' || user?.tipo_suscripcion === 'institucional';
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [giftCodeInput, setGiftCodeInput] = useState('');
    const [tipoCompra, setTipoCompra] = useState(isPremium ? 'regalo_1_mes' : 'directo');
    const navigate = useNavigate();

    const refreshSession = async () => {
        try {
            const res = await fetch(`${API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                login(data.user, data.token);
            }
        } catch (err) {
            console.error('Error refreshing session:', err);
        }
    };

    const handlePaypal = async () => {
        setLoading(true);
        setError('');
        try {
            const createRes = await fetch(`${API_URL}/api/pagos/paypal/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tipoCompra })
            });
            const order = await createRes.json();
            
            if (order.id && order.links) {
                const approveLink = order.links.find(link => link.rel === 'approve');
                if (approveLink) {
                    const width = 500;
                    const height = 700;
                    const left = window.screen.width / 2 - width / 2;
                    const top = window.screen.height / 2 - height / 2;
                    
                    const popup = window.open(
                        approveLink.href, 
                        'paypal', 
                        `width=${width},height=${height},left=${left},top=${top}`
                    );
                    
                    const timer = setInterval(() => {
                        if (popup && popup.closed) {
                            clearInterval(timer);
                            handleConfirmPaypal(order.id, tipoCompra);
                        }
                    }, 1000);

                } else {
                    setError('No se encontró el enlace de aprobación de PayPal.');
                    setLoading(false);
                }
            } else {
                setError('Hubo un error al crear la orden.');
                setLoading(false);
            }
        } catch (err) {
            setError('Hubo un error de conexión con PayPal.');
            setLoading(false);
        }
    };

    const handleConfirmPaypal = async (orderId, tipo) => {
        setLoading(true);
        setError('');
        try {
            const captureRes = await fetch(`${API_URL}/api/pagos/paypal/capture-order/${orderId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tipoCompra: tipo })
            });
            
            if (captureRes.ok) {
                if (tipo === 'directo') {
                    setSuccess('¡Pago Exitoso! Disfruta tu cuenta Premium.');
                    await refreshSession();
                } else {
                    setSuccess('¡Compra Exitosa! El código de regalo ha sido enviado a tu correo.');
                }
            } else {
                setError('El pago no pudo ser capturado. ¿Seguro que lo aprobaste en la ventana emergente?');
            }
        } catch (err) {
            setError('Hubo un error al confirmar con PayPal.');
        } finally {
            setLoading(false);
        }
    };

    const handleRedeemCode = async () => {
        if (!giftCodeInput || giftCodeInput.length !== 12) {
            setError('El código debe tener exactamente 12 caracteres.');
            return;
        }
        
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/pagos/redeem-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ codigo: giftCodeInput })
            });
            const data = await res.json();
            if (res.ok) {
                setSuccess('¡Código canjeado con éxito! Disfruta de tu Premium.');
                await refreshSession();
            } else {
                setError(data.message || 'Error al canjear el código.');
            }
        } catch (err) {
            setError('Hubo un error de conexión al canjear el código.');
        } finally {
            setLoading(false);
        }
    };

    const handlePayphone = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/pagos/payphone/prepare`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amount: tipoCompra.includes('anio') ? 9999 : 999 })
            });
            const data = await res.json();
            
            if (data.ok) {
                window.open(data.paymentUrl, '_blank');
                // Simular confirmación en esta demo
                const confirmRes = await fetch(`${API_URL}/api/pagos/payphone/confirm`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (confirmRes.ok) {
                    if (tipoCompra === 'directo') {
                        setSuccess('¡Pago Exitoso! Disfruta tu cuenta Premium.');
                    } else {
                        setSuccess('¡Compra Exitosa! El código de regalo ha sido enviado a tu correo.');
                    }
                    await refreshSession();
                }
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Hubo un error con PayPhone.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="system-panel" style={{ textAlign: 'center', background: 'rgba(255, 215, 0, 0.1)', borderColor: 'gold' }}>
            <h2 style={{ color: 'gold', marginBottom: '1rem' }}>Suscripción Premium 🎹</h2>
            
            {error && <p style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '5px' }}>{error}</p>}
            {success && <p style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '5px' }}>{success}</p>}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem', textAlign: 'left' }}>
                
                {/* Lado de Compra */}
                <div style={{ padding: '1.5rem', borderRight: '1px solid rgba(255, 215, 0, 0.3)' }}>
                    <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>Comprar / Regalar</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
                        {!isPremium && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input 
                                    type="radio" 
                                    name="tipoCompra" 
                                    checked={tipoCompra === 'directo'}
                                    onChange={() => setTipoCompra('directo')}
                                />
                                <span>Mejora para mí (1 Mes) - <strong>$9.99</strong></span>
                            </label>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="tipoCompra" 
                                checked={tipoCompra === 'regalo_1_mes'}
                                onChange={() => setTipoCompra('regalo_1_mes')}
                            />
                            <span>Código de Regalo (1 Mes) - <strong>$9.99</strong></span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="tipoCompra" 
                                checked={tipoCompra === 'regalo_1_anio'}
                                onChange={() => setTipoCompra('regalo_1_anio')}
                            />
                            <span>Código de Regalo (1 Año) - <strong>$99.99</strong></span>
                        </label>
                    </div>

                    <button 
                        className="btn-system" 
                        style={{ background: '#003087', borderColor: '#003087', color: 'white', width: '100%' }}
                        onClick={handlePaypal}
                        disabled={loading}
                    >
                        {loading ? 'Procesando...' : 'Pagar con PayPal'}
                    </button>

                    <button 
                        className="btn-system" 
                        style={{ background: '#FF4500', borderColor: '#FF4500', color: 'white', width: '100%', marginTop: '10px' }}
                        onClick={handlePayphone}
                        disabled={loading}
                    >
                        {loading ? 'Procesando...' : 'Pagar con PayPhone'}
                    </button>

                    {tipoCompra.includes('regalo') && (
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '10px' }}>
                            El código será enviado a tu correo registrado.
                        </p>
                    )}
                </div>

                {/* Lado de Canje */}
                <div style={{ padding: '1.5rem' }}>
                    <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>Tengo un Código</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Si recibiste un código de 12 dígitos, ingrésalo aquí para desbloquear Premium.
                    </p>
                    <input
                        type="text"
                        placeholder="Ej. A1B2C3D4E5F6"
                        value={giftCodeInput}
                        onChange={(e) => setGiftCodeInput(e.target.value.toUpperCase())}
                        maxLength={12}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                            borderRadius: '8px',
                            marginBottom: '1rem',
                            fontSize: '1rem',
                            letterSpacing: '2px',
                            textTransform: 'uppercase',
                            textAlign: 'center',
                            fontFamily: 'monospace'
                        }}
                    />
                    <button 
                        className="btn-system" 
                        style={{ width: '100%', background: 'var(--accent-secondary)' }}
                        onClick={handleRedeemCode}
                        disabled={loading}
                    >
                        {loading ? 'Canjeando...' : 'Canjear Código'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PremiumUpgrade;
