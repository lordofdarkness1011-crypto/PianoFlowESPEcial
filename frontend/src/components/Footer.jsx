import React, { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

const Footer = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <footer style={{
            marginTop: 'auto',
            padding: '1.5rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'var(--bg-base)',
            borderTop: '1px solid var(--border-light)'
        }}>
            <div className="system-panel" style={{ padding: '6px 8px', display: 'flex', gap: '8px', borderRadius: '50px', boxShadow: 'none', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}>
                <button 
                    onClick={() => toggleTheme('light')}
                    style={{
                        background: theme === 'light' ? 'var(--accent-primary)' : 'transparent',
                        color: theme === 'light' ? 'white' : 'var(--text-muted)',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span style={{ fontSize: '1.1rem' }}>☀️</span> Claro
                </button>
                <button 
                    onClick={() => toggleTheme('dark')}
                    style={{
                        background: theme === 'dark' ? 'var(--accent-primary)' : 'transparent',
                        color: theme === 'dark' ? 'white' : 'var(--text-muted)',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span style={{ fontSize: '1.1rem' }}>🌙</span> Oscuro
                </button>
            </div>
        </footer>
    );
};

export default Footer;
