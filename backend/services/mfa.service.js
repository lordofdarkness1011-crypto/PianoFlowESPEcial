const { authenticator } = require("@otplib/preset-default");
const QRCode = require("qrcode");
const pool = require("../utils/db");
const { normalizeEmail } = require("../utils/email.util");
const bcrypt = require("bcryptjs");
const AppError = require("../utils/app-error");
const { env } = require("../config/env");

authenticator.options = {
    step: 30,
    window: env.MFA_WINDOW
};

function publicMfaUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        mfaEnabled: Boolean(user.mfaEnabled)
    };
}

async function getActiveUser(email) {
    const normalizedEmail = normalizeEmail(email);
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];

    if (!user) {
        throw new AppError("La cuenta no se encuentra registrada.", 404);
    }

    if (user.status !== "ACTIVE") {
        throw new AppError(
            "La cuenta debe estar activa antes de usar autenticación en dos pasos.",
            403
        );
    }

    return user;
}

async function startMfaSetup({ email }) {
    const user = await getActiveUser(email);

    if (user.mfa_enabled) {
        throw new AppError(
            "La autenticación en dos pasos ya está activada para esta cuenta.",
            409
        );
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, env.MFA_ISSUER, secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    await pool.query('UPDATE usuarios SET pending_mfa_secret = $1 WHERE email = $2', [secret, user.email]);

    return {
        message: "Escanee el código QR con Microsoft Authenticator o Google Authenticator.",
        email: user.email,
        issuer: env.MFA_ISSUER,
        manualKey: secret,
        qrCode
    };
}

async function confirmMfaSetup({ email, code }) {
    const user = await getActiveUser(email);
    const cleanCode = String(code || "").replace(/\s/g, "");

    if (!user.pending_mfa_secret) {
        throw new AppError(
            "No existe una configuración MFA pendiente para esta cuenta.",
            400
        );
    }

    if (!cleanCode) {
        throw new AppError("El código del autenticador es obligatorio.", 400);
    }

    const isValid = authenticator.check(cleanCode, user.pending_mfa_secret);

    if (!isValid) {
        throw new AppError(
            "El código ingresado no es válido. Revise la hora del celular o espere un nuevo código.",
            400
        );
    }

    const updateResult = await pool.query(
        'UPDATE usuarios SET mfa_enabled = true, mfa_secret = $1, pending_mfa_secret = NULL WHERE email = $2 RETURNING *',
        [user.pending_mfa_secret, user.email]
    );

    return {
        message: "Autenticación en dos pasos activada correctamente.",
        user: { email: updateResult.rows[0].email }
    };
}

async function loginFirstStep({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    const cleanPassword = String(password || "");
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];

    if (!user) {
        throw new AppError("Correo o contraseña incorrectos.", 401);
    }

    if (user.status !== "ACTIVE") {
        throw new AppError(
            "La cuenta debe estar activa antes de iniciar sesión.",
            403
        );
    }

    if (!user.password_hash) {
        throw new AppError(
            "La cuenta no tiene contraseña registrada. Registre nuevamente el usuario.",
            400
        );
    }

    const passwordIsValid = await bcrypt.compare(cleanPassword, user.password_hash);

    if (!passwordIsValid) {
        throw new AppError("Correo o contraseña incorrectos.", 401);
    }

    if (!user.mfa_enabled) {
        return {
            message: "Inicio de sesión correcto. La cuenta no tiene 2FA activo.",
            requiresMfa: false,
            user: { email: user.email }
        };
    }

    return {
        message: "Primer factor correcto. Ingrese el código del autenticador.",
        requiresMfa: true,
        email: user.email
    };
}

async function verifyMfaLogin({ email, code }) {
    const user = await getActiveUser(email);
    const cleanCode = String(code || "").replace(/\s/g, "");

    if (!user.mfa_enabled || !user.mfa_secret) {
        throw new AppError(
            "La cuenta no tiene autenticación en dos pasos activada.",
            400
        );
    }

    if (!cleanCode) {
        throw new AppError("El código MFA es obligatorio.", 400);
    }

    const isValid = authenticator.check(cleanCode, user.mfa_secret);

    if (!isValid) {
        throw new AppError("El código MFA no es válido o ya venció.", 400);
    }

    return {
        message: "Inicio de sesión completado con segundo factor.",
        user: { email: user.email }
    };
}

async function getMfaStatus(email) {
    const user = await getActiveUser(email);

    return {
        user: { email: user.email, mfaEnabled: user.mfa_enabled }
    };
}

module.exports = {
    startMfaSetup,
    confirmMfaSetup,
    loginFirstStep,
    verifyMfaLogin,
    getMfaStatus
};