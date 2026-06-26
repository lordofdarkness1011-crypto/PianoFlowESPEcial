import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error Boundary atrapó un error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-base)', flexDirection: 'column', padding: '2rem', textAlign: 'center' }}>
            <div className="system-panel" style={{ maxWidth: '500px' }}>
                <h1 style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '1rem' }}>⚠️ Falla Crítica del Sistema</h1>
                <p style={{ color: 'var(--text-main)', marginBottom: '2rem' }}>
                    Se ha detectado una excepción en la renderización de la interfaz. Los servicios distribuidos han sido protegidos.
                </p>
                <button 
                    className="btn-system" 
                    onClick={() => window.location.href = '/'}
                    style={{ background: 'var(--accent-primary)', color: 'white' }}
                >
                    Reiniciar Módulo
                </button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
