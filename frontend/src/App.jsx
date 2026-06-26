import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { InputProvider } from './context/InputContext';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import MidiSetup from './pages/MidiSetup';
import FreePlay from './pages/FreePlay';
import ConcertRooms from './pages/ConcertRooms';
import ConcertRoom from './pages/ConcertRoom';
import PianoCanvas from './components/PianoCanvas';
import NotFound from './pages/NotFound';
import Footer from './components/Footer';
import './App.css';

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useContext(AuthContext);
    
    if (loading) return <div style={{color:'var(--text-main)', padding:'2rem', textAlign:'center'}}>Cargando sesión...</div>;
    return user ? children : <Navigate to="/" />;
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <InputProvider>
          <OfflineBanner />
          <Router>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-base)' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <Routes>
                          <Route path="/" element={<Login />} />
                          
                          <Route path="/dashboard" element={
                              <ProtectedRoute>
                                  <Dashboard />
                              </ProtectedRoute>
                          } />

                          <Route path="/profile" element={
                              <ProtectedRoute>
                                  <Profile />
                              </ProtectedRoute>
                          } />

                          <Route path="/setup" element={
                              <ProtectedRoute>
                                  <MidiSetup />
                              </ProtectedRoute>
                          } />

                          <Route path="/freeplay" element={
                              <ProtectedRoute>
                                  <FreePlay />
                              </ProtectedRoute>
                          } />

                          <Route path="/rooms" element={
                              <ProtectedRoute>
                                  <ConcertRooms />
                              </ProtectedRoute>
                          } />

                          <Route path="/rooms/:roomId" element={
                              <ProtectedRoute>
                                  <ConcertRoom />
                              </ProtectedRoute>
                          } />
                          
                          <Route path="/play" element={
                              <ProtectedRoute>
                                  <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                                      <button 
                                          onClick={() => window.history.back()} 
                                          className="btn-system"
                                          style={{ marginBottom: '20px' }}>
                                          ← Volver al Dashboard
                                      </button>
                                      <PianoCanvas />
                                  </div>
                              </ProtectedRoute>
                          } />

                          <Route path="*" element={<NotFound />} />
                      </Routes>
                  </div>
                  <Footer />
              </div>
          </Router>
        </InputProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
