const winston = require('winston');

// Configuración de Winston para el registro de eventos y trazabilidad
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'pianoflow-backend' },
    transports: [
        // Según las instrucciones, todo evento (login, error, websockets) debe registrarse en app.log
        new winston.transports.File({ filename: 'app.log' })
    ]
});

// En entornos de nube como Render, necesitamos ver los logs en la consola siempre
logger.add(new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
    )
}));

module.exports = logger;
