const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../utils/db');
const logger = require('../utils/logger');
const verificationService = require('../services/verification.service');
const mfaService = require('../services/mfa.service');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// -------------------------------------------------------------
// GOOGLE OAUTH
// -------------------------------------------------------------
const googleLogin = async (req, res, next) => {
    try {
        const { googleToken } = req.body;
        
        if (!googleToken) {
            return res.status(400).json({ success: false, message: 'El token de Google es requerido' });
        }

        const ticket = await client.verifyIdToken({
            idToken: googleToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name: nombre, picture: googleAvatarUrl } = payload;
        
        let avatarUrlToSave = googleAvatarUrl; // Por defecto fallback a google

        // Subir a Cloudinary
        try {
            const cloudinary = require('../utils/cloudinary');
            // Cloudinary permite subir directamente desde una URL pública
            const uploadResult = await cloudinary.uploader.upload(googleAvatarUrl, {
                folder: 'pianoflow/avatars',
                public_id: `avatar_${googleId}`,
                overwrite: true
            });
            avatarUrlToSave = uploadResult.secure_url;
            logger.info(`Avatar guardado en Cloudinary exitosamente: ${avatarUrlToSave}`);
        } catch (cloudError) {
            logger.error(`Falló la subida a Cloudinary, se usará URL de Google: ${cloudError.message}`);
        }

        // Buscar por email para evitar duplicados
        let query = 'SELECT * FROM usuarios WHERE email = $1';
        let result = await pool.query(query, [email]);
        let usuario = result.rows[0];

        if (!usuario) {
            // Usuario totalmente nuevo
            const insertQuery = `
                INSERT INTO usuarios (google_id, email, nombre, avatar_url)
                VALUES ($1, $2, $3, $4)
                RETURNING *;
            `;
            const insertResult = await pool.query(insertQuery, [googleId, email, nombre, avatarUrlToSave]);
            usuario = insertResult.rows[0];
            logger.info(`Nuevo registro: Usuario creado vía Google OAuth. Email: ${email}`);
        } else {
            // Usuario ya existía. Vinculamos la cuenta o actualizamos el avatar
            if (!usuario.google_id || usuario.avatar_url !== avatarUrlToSave) {
                const updateQuery = `
                    UPDATE usuarios SET google_id = $1, avatar_url = $2 WHERE email = $3 RETURNING *;
                `;
                const updateRes = await pool.query(updateQuery, [googleId, avatarUrlToSave, email]);
                usuario = updateRes.rows[0];
                logger.info(`Cuenta vinculada con Google OAuth y avatar actualizado: ${email}`);
            } else {
                logger.info(`Login exitoso OAuth: ${email}`);
            }
        }

        const jwtPayload = {
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            avatar_url: usuario.avatar_url,
            nivel_habilidad: usuario.nivel_habilidad,
            tipo_suscripcion: usuario.tipo_suscripcion,
            premium_expires_at: usuario.premium_expires_at
        };

        const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.status(200).json({ success: true, token, user: jwtPayload });
    } catch (error) {
        logger.error(`Error en googleLogin (OAuth): ${error.message}`);
        next(error);
    }
};

// -------------------------------------------------------------
// LOGIN TRADICIONAL (MFA)
// -------------------------------------------------------------
const loginTradicional = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const result = await mfaService.loginFirstStep({ email, password });

        if (result.requiresMfa) {
            return res.status(200).json({ success: true, requiresMfa: true, message: result.message, email });
        }

        // Si no requiere MFA, procedemos con JWT
        let query = 'SELECT * FROM usuarios WHERE email = $1';
        let userResult = await pool.query(query, [email]);
        let usuario = userResult.rows[0];

        const jwtPayload = {
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            avatar_url: usuario.avatar_url,
            nivel_habilidad: usuario.nivel_habilidad,
            tipo_suscripcion: usuario.tipo_suscripcion,
            premium_expires_at: usuario.premium_expires_at
        };

        const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
        logger.info(`Login exitoso Tradicional: ${email}`);
        res.status(200).json({ success: true, token, user: jwtPayload });
    } catch (error) {
        logger.error(`Error en loginTradicional: ${error.message}`);
        next(error);
    }
};

const verifyMfaLogin = async (req, res, next) => {
    try {
        const { email, code } = req.body;
        await mfaService.verifyMfaLogin({ email, code });

        let query = 'SELECT * FROM usuarios WHERE email = $1';
        let userResult = await pool.query(query, [email]);
        let usuario = userResult.rows[0];

        const jwtPayload = {
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            avatar_url: usuario.avatar_url,
            nivel_habilidad: usuario.nivel_habilidad,
            tipo_suscripcion: usuario.tipo_suscripcion,
            premium_expires_at: usuario.premium_expires_at
        };

        const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
        logger.info(`Login exitoso MFA: ${email}`);
        res.status(200).json({ success: true, token, user: jwtPayload });
    } catch (error) {
        logger.error(`Error en verifyMfaLogin: ${error.message}`);
        next(error);
    }
};

// -------------------------------------------------------------
// REGISTRO TRADICIONAL
// -------------------------------------------------------------
const registroTradicional = async (req, res, next) => {
    try {
        const { email, password, nombre } = req.body;
        const result = await verificationService.registerUser({ name: nombre, email, password });
        logger.info(`Nuevo registro iniciado (INACTIVE): Email: ${email}`);
        res.status(201).json({ success: true, message: result.message, user: result.user });
    } catch (error) {
        logger.error(`Error en registroTradicional: ${error.message}`);
        next(error);
    }
};

const verifyAccount = async (req, res, next) => {
    try {
        const result = await verificationService.verifyAccount(req.body);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

const resendCode = async (req, res, next) => {
    try {
        const result = await verificationService.resendVerificationCode(req.body.email);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

// -------------------------------------------------------------
// MFA CONFIGURATION
// -------------------------------------------------------------
const setupMfa = async (req, res, next) => {
    try {
        const result = await mfaService.startMfaSetup({ email: req.body.email });
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

const confirmMfa = async (req, res, next) => {
    try {
        const result = await mfaService.confirmMfaSetup(req.body);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

const getMfaStatus = async (req, res, next) => {
    try {
        const result = await mfaService.getMfaStatus(req.params.email);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    googleLogin,
    loginTradicional,
    verifyMfaLogin,
    registroTradicional,
    verifyAccount,
    resendCode,
    setupMfa,
    confirmMfa,
    getMfaStatus
};
