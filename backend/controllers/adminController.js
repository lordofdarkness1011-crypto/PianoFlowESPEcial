const pool = require('../utils/db');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Obtener usuarios paginados y con búsqueda
const getUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        const countQuery = `
            SELECT COUNT(*) FROM usuarios 
            WHERE email ILIKE $1 OR nombre ILIKE $1
        `;
        const countResult = await pool.query(countQuery, [`%${search}%`]);
        const total = parseInt(countResult.rows[0].count);

        const dataQuery = `
            SELECT id, email, nombre, avatar_url, tipo_suscripcion, rol, status, premium_expires_at, creado_en 
            FROM usuarios 
            WHERE email ILIKE $1 OR nombre ILIKE $1
            ORDER BY creado_en DESC 
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(dataQuery, [`%${search}%`, limit, offset]);

        res.status(200).json({
            success: true,
            data: result.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error(`Error en admin getUsers: ${error.message}`);
        next(error);
    }
};

// Obsequiar Premium a un usuario
const grantPremium = async (req, res, next) => {
    try {
        const { usuario_id, meses } = req.body;
        if (!usuario_id || !meses) {
            return res.status(400).json({ success: false, message: 'Faltan datos requeridos (usuario_id, meses)' });
        }

        const updateQuery = `
            UPDATE usuarios 
            SET tipo_suscripcion = 'premium',
                premium_expires_at = COALESCE(premium_expires_at, CURRENT_TIMESTAMP) + $1::INTERVAL
            WHERE id = $2
            RETURNING email, premium_expires_at
        `;
        const result = await pool.query(updateQuery, [`${meses} months`, usuario_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        logger.info(`Administrador otorgó ${meses} meses premium al usuario ID: ${usuario_id}`);
        res.status(200).json({ success: true, message: `Premium otorgado exitosamente`, user: result.rows[0] });
    } catch (error) {
        logger.error(`Error en grantPremium: ${error.message}`);
        next(error);
    }
};

// Generar Código de Regalo manualmente (sin pagar)
const generateCode = async (req, res, next) => {
    try {
        const { meses } = req.body;
        if (!meses) return res.status(400).json({ success: false, message: 'Meses requeridos' });

        const buf = crypto.randomBytes(6);
        const code = buf.toString('hex').toUpperCase();

        const insertQuery = `
            INSERT INTO codigos_regalo (codigo, duracion_meses, comprador_id, fecha_expiracion)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '3 months')
            RETURNING *
        `;
        const result = await pool.query(insertQuery, [code, meses, req.user.id]);

        logger.info(`Administrador generó el código de regalo ${code} por ${meses} meses`);
        res.status(200).json({ success: true, codigo: result.rows[0], message: 'Código generado exitosamente' });
    } catch (error) {
        logger.error(`Error en generateCode: ${error.message}`);
        next(error);
    }
};

// Activar/Desactivar Usuario (Borrado Lógico)
const toggleUserStatus = async (req, res, next) => {
    try {
        const { usuario_id } = req.body;
        if (!usuario_id) return res.status(400).json({ success: false, message: 'usuario_id requerido' });

        if (usuario_id === req.user.id) {
            return res.status(400).json({ success: false, message: 'No puedes desactivar tu propia cuenta maestra' });
        }

        // Obtener estado actual
        const check = await pool.query('SELECT status FROM usuarios WHERE id = $1', [usuario_id]);
        if (check.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        
        const newStatus = check.rows[0].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

        const updateQuery = `UPDATE usuarios SET status = $1 WHERE id = $2 RETURNING id, status`;
        const result = await pool.query(updateQuery, [newStatus, usuario_id]);

        logger.info(`Administrador cambió estado de usuario ID ${usuario_id} a ${newStatus}`);
        res.status(200).json({ success: true, message: `Usuario ahora está ${newStatus}`, user: result.rows[0] });
    } catch (error) {
        logger.error(`Error en toggleUserStatus: ${error.message}`);
        next(error);
    }
};

// Obtener lista de códigos generados
const getCodes = async (req, res, next) => {
    try {
        const query = `
            SELECT 
                c.id, 
                c.codigo, 
                c.duracion_meses, 
                c.estado, 
                c.fecha_creacion, 
                c.fecha_expiracion, 
                c.fecha_uso,
                comp.nombre AS comprador_nombre,
                comp.email AS comprador_email,
                comp.rol AS comprador_rol,
                red.nombre AS redentor_nombre,
                red.email AS redentor_email
            FROM codigos_regalo c
            LEFT JOIN usuarios comp ON c.comprador_id = comp.id
            LEFT JOIN usuarios red ON c.usuario_redencion_id = red.id
            ORDER BY c.fecha_creacion DESC
        `;
        const result = await pool.query(query);

        // Formatear estado detallado (activo vs expirado)
        const codesFormatted = result.rows.map(c => {
            let estado_detallado = c.estado;
            if (c.estado === 'no usado') {
                const expirado = new Date(c.fecha_expiracion) < new Date();
                estado_detallado = expirado ? 'No usado (Expirado)' : 'No usado (Activo)';
            } else if (c.estado === 'usado') {
                estado_detallado = 'Usado';
            }

            return {
                ...c,
                estado_detallado
            };
        });

        res.status(200).json({ success: true, data: codesFormatted });
    } catch (error) {
        logger.error(`Error en admin getCodes: ${error.message}`);
        next(error);
    }
};

module.exports = {
    getUsers,
    grantPremium,
    generateCode,
    toggleUserStatus,
    getCodes
};
