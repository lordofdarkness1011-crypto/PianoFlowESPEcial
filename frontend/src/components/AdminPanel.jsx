import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AdminPanel = () => {
    const { token } = useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [codes, setCodes] = useState([]);
    const [activeTab, setActiveTab] = useState('usuarios'); // 'usuarios' o 'codigos'
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [generatedCode, setGeneratedCode] = useState(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/users?page=${page}&search=${search}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setUsers(data.data);
                setTotalPages(data.pagination.totalPages);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCodes = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/codes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setCodes(data.data);
            }
        } catch (error) {
            console.error("Error fetching codes:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'usuarios') {
            const debounce = setTimeout(() => {
                fetchUsers();
            }, 300);
            return () => clearTimeout(debounce);
        } else {
            fetchCodes();
        }
    }, [search, page, activeTab]);

    const handleGrantPremium = async (userId) => {
        const meses = prompt("¿Cuántos meses de premium deseas obsequiarle a este usuario?");
        if (!meses || isNaN(meses)) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/grant-premium`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ usuario_id: userId, meses: parseInt(meses) })
            });
            const data = await res.json();
            if (data.success) {
                alert(`¡Premium otorgado! Válido hasta: ${new Date(data.user.premium_expires_at).toLocaleDateString()}`);
                fetchUsers();
            } else {
                alert(data.message);
            }
        } catch (error) {
            alert('Error al procesar la solicitud');
        }
    };

    const handleGenerateCode = async () => {
        const meses = prompt("¿De cuántos meses será este código de regalo?");
        if (!meses || isNaN(meses)) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/generate-code`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ meses: parseInt(meses) })
            });
            const data = await res.json();
            if (data.success) {
                setGeneratedCode(data.codigo.codigo);
            }
        } catch (error) {
            alert('Error generando código');
        }
    };

    const handleToggleStatus = async (userId) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/toggle-status`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ usuario_id: userId })
            });
            const data = await res.json();
            if (data.success) {
                fetchUsers();
            } else {
                alert(data.message);
            }
        } catch (error) {
            alert('Error cambiando estado');
        }
    };

    return (
        <div className="system-panel" style={{ marginTop: '2rem', border: '2px solid var(--accent-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ margin: '0', fontSize: '1.5rem', color: 'var(--accent-secondary)' }}>
                        🛡️ Panel Maestro (God Mode)
                    </h2>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>Administra usuarios y genera códigos sin costo.</p>
                </div>
                <button className="btn-system" onClick={handleGenerateCode} style={{ background: 'var(--accent-secondary)', color: '#000', fontWeight: 'bold' }}>
                    + Generar Código Premium
                </button>
            </div>

            {generatedCode && (
                <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ margin: 0, color: '#10b981', fontWeight: 'bold' }}>¡Código Generado!</p>
                        <span className="text-mono" style={{ fontSize: '1.5rem', letterSpacing: '2px' }}>{generatedCode}</span>
                    </div>
                    <button className="btn-system" onClick={() => navigator.clipboard.writeText(generatedCode)}>Copiar</button>
                </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--bg-surface-hover)', marginBottom: '1.5rem' }}>
                <button 
                    style={{ 
                        padding: '10px 20px', 
                        background: 'none', 
                        border: 'none', 
                        borderBottom: activeTab === 'usuarios' ? '3px solid var(--accent-secondary)' : '3px solid transparent',
                        color: activeTab === 'usuarios' ? 'var(--text-main)' : 'var(--text-muted)',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                    onClick={() => { setActiveTab('usuarios'); setPage(1); }}
                >
                    Usuarios
                </button>
                <button 
                    style={{ 
                        padding: '10px 20px', 
                        background: 'none', 
                        border: 'none', 
                        borderBottom: activeTab === 'codigos' ? '3px solid var(--accent-secondary)' : '3px solid transparent',
                        color: activeTab === 'codigos' ? 'var(--text-main)' : 'var(--text-muted)',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                    onClick={() => setActiveTab('codigos')}
                >
                    Facturación y Códigos
                </button>
            </div>

            {activeTab === 'usuarios' ? (
                <>
                    <div style={{ marginBottom: '1rem' }}>
                        <input 
                            type="text" 
                            placeholder="Buscar usuario por nombre o correo..." 
                            className="system-input" 
                            style={{ width: '100%', maxWidth: '400px' }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--bg-surface-hover)' }}>
                            <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>ID</th>
                            <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Usuario</th>
                            <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Plan</th>
                            <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Estado</th>
                            <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center' }}>Cargando usuarios...</td></tr>
                        ) : users.map(u => (
                            <tr key={u.id} style={{ borderBottom: '1px solid var(--bg-surface-hover)' }}>
                                <td style={{ padding: '12px 8px' }}>#{u.id}</td>
                                <td style={{ padding: '12px 8px' }}>
                                    <div style={{ fontWeight: 'bold' }}>{u.nombre} {u.rol === 'admin' && '👑'}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{u.email}</div>
                                </td>
                                <td style={{ padding: '12px 8px' }}>
                                    <span style={{ 
                                        padding: '4px 8px', 
                                        borderRadius: '12px', 
                                        fontSize: '0.8rem', 
                                        fontWeight: 'bold',
                                        background: u.tipo_suscripcion === 'premium' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(156, 163, 175, 0.2)',
                                        color: u.tipo_suscripcion === 'premium' ? '#3b82f6' : '#9ca3af'
                                    }}>
                                        {u.tipo_suscripcion.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '12px 8px' }}>
                                    <span style={{ 
                                        color: u.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                                        fontWeight: 'bold',
                                        fontSize: '0.9rem'
                                    }}>
                                        {u.status}
                                    </span>
                                </td>
                                <td style={{ padding: '12px 8px', display: 'flex', gap: '8px' }}>
                                    <button 
                                        className="btn-system" 
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', background: 'var(--bg-surface-hover)' }}
                                        onClick={() => handleGrantPremium(u.id)}
                                        disabled={u.rol === 'admin'}
                                    >
                                        🎁 Regalar
                                    </button>
                                    <button 
                                        className="btn-system" 
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', background: u.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: u.status === 'ACTIVE' ? '#ef4444' : '#10b981' }}
                                        onClick={() => handleToggleStatus(u.id)}
                                        disabled={u.rol === 'admin'}
                                    >
                                        {u.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <button 
                    className="btn-system" 
                    disabled={page === 1} 
                    onClick={() => setPage(p => p - 1)}
                >
                    Anterior
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Página {page} de {totalPages}
                </span>
                <button 
                    className="btn-system" 
                    disabled={page === totalPages || totalPages === 0} 
                    onClick={() => setPage(p => p + 1)}
                >
                    Siguiente
                </button>
            </div>
            </>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--bg-surface-hover)' }}>
                                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Código</th>
                                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Comprador / Emisor</th>
                                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Redentor</th>
                                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Meses</th>
                                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center' }}>Cargando códigos...</td></tr>
                            ) : codes.map(c => (
                                <tr key={c.id} style={{ borderBottom: '1px solid var(--bg-surface-hover)' }}>
                                    <td style={{ padding: '12px 8px', fontWeight: 'bold', letterSpacing: '1px' }}>{c.codigo}</td>
                                    <td style={{ padding: '12px 8px' }}>
                                        {c.comprador_nombre ? (
                                            <>
                                                <div>{c.comprador_nombre} {c.comprador_rol === 'admin' && '(Admin)'}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.comprador_email}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.fecha_creacion).toLocaleDateString()}</div>
                                            </>
                                        ) : <span style={{ color: 'var(--text-muted)' }}>Desconocido</span>}
                                    </td>
                                    <td style={{ padding: '12px 8px' }}>
                                        {c.redentor_nombre ? (
                                            <>
                                                <div>{c.redentor_nombre}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.redentor_email}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.fecha_uso).toLocaleDateString()}</div>
                                            </>
                                        ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                    </td>
                                    <td style={{ padding: '12px 8px' }}>{c.duracion_meses} Meses</td>
                                    <td style={{ padding: '12px 8px' }}>
                                        <span style={{ 
                                            padding: '4px 8px', 
                                            borderRadius: '12px', 
                                            fontSize: '0.8rem', 
                                            fontWeight: 'bold',
                                            background: c.estado_detallado === 'Usado' ? 'rgba(16, 185, 129, 0.2)' : 
                                                        c.estado_detallado === 'No usado (Expirado)' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                            color: c.estado_detallado === 'Usado' ? '#10b981' : 
                                                   c.estado_detallado === 'No usado (Expirado)' ? '#ef4444' : '#3b82f6'
                                        }}>
                                            {c.estado_detallado}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
