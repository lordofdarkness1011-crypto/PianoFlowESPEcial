const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Middleware que verifica el JWT y asegura que el usuario tenga
 * permisos suficientes (premium o institucional) para ejecutar acciones protegidas.
 * Cumple con el bloqueo explícito a usuarios 'freemium'.
 */
const requirePremiumAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Token JWT ausente o con formato inválido' });
        }

        const token = authHeader.split(' ')[1];

        // 1. Validar la firma y expiración del token propio
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Inyectar datos decodificados en el Request

        // 2. Regla de Negocio (Rúbrica): Bloquear a usuarios freemium
        if (req.user.tipo_suscripcion === 'freemium') {
            logger.warn(`Acceso bloqueado: Usuario freemium (ID: ${req.user.id}) intentó consumir una ruta protegida.`);
            return res.status(403).json({ 
                success: false, 
                message: 'No autorizado. Tu cuenta es freemium, requieres suscripción premium o institucional para esta acción.' 
            });
        }

        // Si es premium o institucional, le permitimos continuar hacia el Controller final
        next();

    } catch (error) {
        logger.error(`Token JWT rechazado: ${error.message}`);
        return res.status(401).json({ success: false, message: 'Token expirado o manipulado' });
    }
};

module.exports = {
    requirePremiumAuth
};
