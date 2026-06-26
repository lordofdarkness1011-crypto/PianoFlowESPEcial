const pool = require('../utils/db');
const logger = require('../utils/logger');

/**
 * Guarda el registro de una partida de Piano y actualiza la puntuación total del usuario.
 * Cumple con el requerimiento estricto de usar Transacciones SQL (BEGIN, COMMIT, ROLLBACK).
 * 
 * @param {number} usuarioId - ID del usuario.
 * @param {string} cancionId - ID del archivo MIDI jugado (de PocketBase).
 * @param {number} puntuacionObtenida - Puntos obtenidos en la partida.
 */
const guardarPartidaConTransaccion = async (usuarioId, cancionId, puntuacionObtenida) => {
    // Pedir un cliente dedicado al pool de conexiones para aislar la transacción
    const client = await pool.connect();
    
    try {
        // INICIAR TRANSACCIÓN SQL
        await client.query('BEGIN');

        // 1. Insertar el historial en la tabla partidas
        const insertPartidaQuery = `
            INSERT INTO partidas (usuario_id, cancion_id, puntuacion)
            VALUES ($1, $2, $3)
            RETURNING id;
        `;
        await client.query(insertPartidaQuery, [usuarioId, cancionId, puntuacionObtenida]);

        // 2. Sumar la puntuación a la acumulada del usuario
        const updateUsuarioQuery = `
            UPDATE usuarios
            SET puntuacion_total = puntuacion_total + $1
            WHERE id = $2
            RETURNING puntuacion_total, nivel_habilidad;
        `;
        const resUsuario = await client.query(updateUsuarioQuery, [puntuacionObtenida, usuarioId]);
        
        if (resUsuario.rows.length === 0) {
            throw new Error('Usuario no encontrado');
        }

        const { puntuacion_total, nivel_habilidad } = resUsuario.rows[0];

        // 3. Regla de negocio: Subir de nivel de 'principiante' a 'intermedio' si se superan los 10,000 puntos
        if (puntuacion_total >= 10000 && nivel_habilidad === 'principiante') {
            const levelUpQuery = `
                UPDATE usuarios
                SET nivel_habilidad = 'intermedio'
                WHERE id = $1;
            `;
            await client.query(levelUpQuery, [usuarioId]);
            logger.info(`Usuario ID: ${usuarioId} ha ascendido a nivel intermedio.`);
        }

        // APROBAR TRANSACCIÓN Y VOLCAR CAMBIOS
        await client.query('COMMIT');
        logger.info(`Partida guardada exitosamente. Usuario ID: ${usuarioId}, Puntos: ${puntuacionObtenida}`);
        
        return { success: true, nuevaPuntuacionTotal: puntuacion_total + puntuacionObtenida };

    } catch (error) {
        // REVERTIR CAMBIOS SI ALGO FALLÓ
        await client.query('ROLLBACK');
        logger.error(`Error de base de datos, transacción revertida. Usuario ID: ${usuarioId}. Razón: ${error.message}`);
        throw error;
    } finally {
        // Liberar el cliente sin importar el resultado
        client.release();
    }
};

module.exports = {
    guardarPartidaConTransaccion
};
