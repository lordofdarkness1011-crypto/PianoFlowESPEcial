const express = require('express');
const { 
    googleLogin, loginTradicional, verifyMfaLogin, registroTradicional, 
    verifyAccount, resendCode, setupMfa, confirmMfa, getMfaStatus 
} = require('../controllers/authController');
const { requirePremiumAuth } = require('../middlewares/jwtMiddleware');
const { guardarPartidaConTransaccion } = require('../services/partidaService');
const pagosRoutes = require('./pagosRoutes');

const router = express.Router();

// Rutas públicas: Autenticación
router.post('/auth/google', googleLogin);
router.post('/auth/login', loginTradicional);
router.post('/auth/login/verify', verifyMfaLogin);
router.post('/auth/register', registroTradicional);
router.post('/auth/verify', verifyAccount);
router.post('/auth/resend', resendCode);

// Rutas MFA
router.post('/mfa/setup', setupMfa);
router.post('/mfa/confirm', confirmMfa);
router.get('/mfa/status/:email', getMfaStatus);

// Ruta protegida: Guardar partida
// El middleware requirePremiumAuth bloqueará automáticamente a los "freemium"
router.post('/partidas', requirePremiumAuth, async (req, res, next) => {
    try {
        const { cancionId, puntuacion } = req.body;
        const usuarioId = req.user.id; // Extraído del token decodificado
        
        if (!cancionId || puntuacion === undefined) {
            return res.status(400).json({ success: false, message: 'Faltan datos requeridos (cancionId, puntuacion)' });
        }

        const resultado = await guardarPartidaConTransaccion(usuarioId, cancionId, puntuacion);
        res.status(200).json(resultado);
        
    } catch (error) {
        // Enviar al errorHandler global
        next(error);
    }
});

// Rutas de Pagos
router.use('/pagos', pagosRoutes);

module.exports = router;
