import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PremiumUpgrade = () => {
    const { token, login } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [paypalOrderId, setPaypalOrderId] = useState(null);
    const navigate = useNavigate();

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
                body: JSON.stringify({ amount: 999 })
            });
            const order = await createRes.json();
            
            if (order.id && order.links) {
                const approveLink = order.links.find(link => link.rel === 'approve');
                if (approveLink) {
                    window.open(approveLink.href, '_blank');
                    setPaypalOrderId(order.id);
                } else {
                    setError('No se encontró el enlace de aprobación de PayPal.');
                }
            } else {
                setError('Hubo un error al crear la orden.');
            }
        } catch (err) {
            setError('Hubo un error de conexión con PayPal.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmPaypal = async () => {
        setLoading(true);
        setError('');
        try {
            const captureRes = await fetch(`${API_URL}/api/pagos/paypal/capture-order/${paypalOrderId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (captureRes.ok) {
                setSuccess('¡Pago con PayPal Exitoso! Disfruta tu cuenta Premium.');
                setPaypalOrderId(null);
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } else {
                setError('El pago no pudo ser capturado. ¿Seguro que lo aprobaste en la ventana emergente?');
            }
        } catch (err) {
            setError('Hubo un error al confirmar con PayPal.');
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
                body: JSON.stringify({ amount: 999 }) // En centavos
            });
            const data = await res.json();
            
            if (data.ok) {
                window.open(data.paymentUrl, '_blank');
                // En la vida real aquí abrimos otra pestaña. Simulemos el confirm.
                const confirmRes = await fetch(`${API_URL}/api/pagos/payphone/confirm`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (confirmRes.ok) {
                    setSuccess('¡Pago con PayPhone Exitoso! Disfruta tu cuenta Premium.');
                    setTimeout(() => {
                        navigate('/login');
                    }, 3000);
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
            <h2 style={{ color: 'gold', marginBottom: '1rem' }}>Desbloquea las Salas de Concierto 🎹</h2>
            <p style={{ marginBottom: '1.5rem', color: '#ccc' }}>
                Conviértete en Premium hoy y obtén acceso ilimitado a las salas multijugador para tocar con tus amigos.
            </p>
            {error && <p style={{ color: '#ef4444' }}>{error}</p>}
            {success && <p style={{ color: '#10b981' }}>{success}</p>}
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                        className="btn-system" 
                        style={{ background: '#003087', borderColor: '#003087', color: 'white' }}
                        onClick={handlePaypal}
                        disabled={loading}
                    >
                        {loading ? 'Procesando...' : 'Pagar $9.99 con PayPal'}
                    </button>
                    <button 
                        className="btn-system" 
                        style={{ background: '#FF4500', borderColor: '#FF4500', color: 'white' }}
                        onClick={handlePayphone}
                        disabled={loading}
                    >
                        {loading ? 'Procesando...' : 'Pagar con PayPhone'}
                    </button>
                </div>

                {paypalOrderId && (
                    <div style={{ marginTop: '1rem', padding: '1rem', border: '1px dashed #003087', borderRadius: '8px', background: 'rgba(0, 48, 135, 0.1)' }}>
                        <p style={{ marginBottom: '10px' }}>Por favor aprueba el pago en la ventana emergente de PayPal.</p>
                        <button 
                            className="btn-system btn-accent" 
                            onClick={handleConfirmPaypal}
                            disabled={loading}
                        >
                            {loading ? 'Confirmando...' : 'Ya aprobé el pago, Confirmar 🚀'}
                        </button>
                    </div>
                )}
            </div>
            {success && <p style={{ marginTop: '1rem', fontSize: '0.85rem' }}>Debes iniciar sesión nuevamente para actualizar tu rol.</p>}
        </div>
    );
};

export default PremiumUpgrade;
