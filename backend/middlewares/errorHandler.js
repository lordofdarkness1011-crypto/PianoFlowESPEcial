const logger = require('../utils/logger');

/**
 * Middleware global y centralizado para manejar cualquier error
 * que ocurra en Express y evitar que el servidor Node.js se caiga.
 */
const errorHandler = (err, req, res, next) => {
    // Registramos el error en app.log a través de Winston
    logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    
    // Si hay un stack trace y no es error de validación simple, lo mandamos al log
    if (err.stack) {
        logger.error(err.stack);
    }

    // Configurar el código de estado HTTP
    const statusCode = err.status || 500;
    
    // Devolvemos una respuesta estándar en JSON
    res.status(statusCode).json({
        success: false,
        error: {
            // Ocultamos el mensaje real al usuario final si es un error interno del servidor en producción
            message: (statusCode === 500 && process.env.NODE_ENV === 'production') 
                        ? 'Error Interno del Servidor' 
                        : err.message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
};

module.exports = errorHandler;
