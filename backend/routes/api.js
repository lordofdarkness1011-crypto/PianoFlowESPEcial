const express = require('express');
const { googleLogin, loginTradicional, registroTradicional } = require('../controllers/authController');
const { requirePremiumAuth } = require('../middlewares/jwtMiddleware');
const { guardarPartidaConTransaccion } = require('../services/partidaService');

const router = express.Router();

// Rutas públicas: Autenticación
router.post('/auth/google', googleLogin);
router.post('/auth/login', loginTradicional);
router.post('/auth/register', registroTradicional);

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

module.exports = router;
