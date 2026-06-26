const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../utils/db');
const logger = require('../utils/logger');

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

        // Subir a PocketBase para evidenciar su uso
        try {
            const FormData = require('form-data');
            const { pb } = require('../utils/pb');
            
            const imgRes = await fetch(googleAvatarUrl);
            const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
            
            const formData = new FormData();
            formData.append('file', imgBuffer, {
                filename: `avatar_${googleId}.jpg`,
                contentType: imgRes.headers.get('content-type') || 'image/jpeg',
            });

            // Enviar a la colección avatars
            const record = await pb.collection('avatars').create(formData);
            
            // URL local de PocketBase
            avatarUrlToSave = `http://localhost:8090/api/files/avatars/${record.id}/${record.file}`;
            logger.info(`Avatar guardado en PocketBase físicamente: ${avatarUrlToSave}`);
        } catch (pbError) {
            logger.error(`Falló la subida a PocketBase, se usará URL de Google: ${pbError.message}`);
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
            tipo_suscripcion: usuario.tipo_suscripcion
        };

        const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.status(200).json({ success: true, token, user: jwtPayload });
    } catch (error) {
        logger.error(`Error en googleLogin (OAuth): ${error.message}`);
        next(error);
    }
};

// -------------------------------------------------------------
// LOGIN TRADICIONAL
// -------------------------------------------------------------
const loginTradicional = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
        }

        let query = 'SELECT * FROM usuarios WHERE email = $1';
        let result = await pool.query(query, [email]);
        let usuario = result.rows[0];

        if (!usuario) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        if (!usuario.password_hash) {
            return res.status(401).json({ success: false, message: 'Esta cuenta se creó con Google. Usa el botón de Google para iniciar sesión.' });
        }

        // Comparar contraseñas
        const isMatch = await bcrypt.compare(password, usuario.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        const jwtPayload = {
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            avatar_url: usuario.avatar_url,
            nivel_habilidad: usuario.nivel_habilidad,
            tipo_suscripcion: usuario.tipo_suscripcion
        };

        const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
        logger.info(`Login exitoso Tradicional: ${email}`);
        res.status(200).json({ success: true, token, user: jwtPayload });
    } catch (error) {
        logger.error(`Error en loginTradicional: ${error.message}`);
        next(error);
    }
};

// -------------------------------------------------------------
// REGISTRO TRADICIONAL
// -------------------------------------------------------------
const registroTradicional = async (req, res, next) => {
    try {
        const { email, password, nombre } = req.body;

        if (!email || !password || !nombre) {
            return res.status(400).json({ success: false, message: 'Email, contraseña y nombre son requeridos' });
        }

        // Verificar colisión
        let query = 'SELECT * FROM usuarios WHERE email = $1';
        let result = await pool.query(query, [email]);
        
        if (result.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Ya existe una cuenta con este correo' });
        }

        // Encriptar password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Insertar usuario
        const insertQuery = `
            INSERT INTO usuarios (email, password_hash, nombre)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const insertResult = await pool.query(insertQuery, [email, passwordHash, nombre]);
        
        logger.info(`Nuevo registro: Usuario creado vía Tradicional. Email: ${email}`);

        res.status(201).json({ success: true, message: 'Usuario registrado exitosamente. Por favor, inicia sesión.' });
    } catch (error) {
        logger.error(`Error en registroTradicional: ${error.message}`);
        next(error);
    }
};

module.exports = {
    googleLogin,
    loginTradicional,
    registroTradicional
};
