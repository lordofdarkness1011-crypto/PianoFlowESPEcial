import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import App from './App.jsx'

// Se asume que el cliente ID se configurará en un .env, aquí va un placeholder
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "TU_CLIENTE_ID_DE_GOOGLE.apps.googleusercontent.com";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('ServiceWorker registration successful');
    }).catch((err) => {
      console.error('ServiceWorker registration failed: ', err);
    });
  });
}
