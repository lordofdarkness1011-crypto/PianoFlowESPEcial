const crypto = require("crypto");
const pool = require("../utils/db");
const emailService = require("./email.service");
const queueService = require("./queue.service");
const { createVerificationEmail } = require("../templates/verification-email.template");
const { generateVerificationCode } = require("../utils/code.util");
const { normalizeEmail, isValidEmail } = require("../utils/email.util");
const bcrypt = require("bcryptjs");
const AppError = require("../utils/app-error");
const { env } = require("../config/env");

function createExpirationDate() {
  return new Date(Date.now() + env.CODE_TTL_MINUTES * 60 * 1000);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    mfaEnabled: Boolean(user.mfaEnabled),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt || null
  };
}

async function registerUser({ name, email, password }) {
  const cleanName = String(name || "").trim();
  const normalizedEmail = normalizeEmail(email);
  const cleanPassword = String(password || "").trim();

  if (!cleanName || !normalizedEmail) {
    throw new AppError("El nombre y el correo son obligatorios.", 400);
  }

  if (!isValidEmail(normalizedEmail)) {
    throw new AppError("El formato del correo electrónico es incorrecto.", 400);
  }

  if (!cleanPassword || cleanPassword.length < 6) {
    throw new AppError(
      "La contraseña es obligatoria y debe tener al menos 6 caracteres.",
      400
    );
  }

  const query = 'SELECT * FROM usuarios WHERE email = $1';
  const result = await pool.query(query, [normalizedEmail]);
  const existingUser = result.rows[0];

  if (existingUser && existingUser.status === "ACTIVE") {
    throw new AppError("La cuenta ya se encuentra activa.", 409);
  }

  const verificationCode = generateVerificationCode();
  const expiresAt = createExpirationDate();
  
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(cleanPassword, salt);

  let user;
  if (!existingUser) {
      // Insert new inactive user
      const insertQuery = `
          INSERT INTO usuarios (email, password_hash, nombre, status, verification_code, expires_at, verification_attempts)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *;
      `;
      const insertResult = await pool.query(insertQuery, [
          normalizedEmail, passwordHash, cleanName, 'INACTIVE', verificationCode, expiresAt, 0
      ]);
      user = insertResult.rows[0];
  } else {
      // Update existing inactive user
      const updateQuery = `
          UPDATE usuarios 
          SET password_hash = $1, nombre = $2, verification_code = $3, expires_at = $4, verification_attempts = 0
          WHERE email = $5
          RETURNING *;
      `;
      const updateResult = await pool.query(updateQuery, [
          passwordHash, cleanName, verificationCode, expiresAt, normalizedEmail
      ]);
      user = updateResult.rows[0];
  }

  const message = createVerificationEmail({
    name: user.nombre,
    code: verificationCode,
    expirationMinutes: env.CODE_TTL_MINUTES
  });

  queueService.enqueueEmailTask({
    type: "ACCOUNT_VERIFICATION",
    to: user.email,
    subject: message.subject,
    html: message.html
  });

  return {
    message:
      "Cuenta registrada como inactiva. Se envió un código al correo proporcionado.",
    user: publicUser(user),
    codeExpiresAt: user.expiresAt
  };
}

function getMfaStatus(email) {
  // handled in mfa
}

async function verifyAccount({ email, code }) {
  const normalizedEmail = normalizeEmail(email);
  const cleanCode = String(code || "").trim();

  if (!normalizedEmail || !cleanCode) {
    throw new AppError("El correo y el código son obligatorios.", 400);
  }

  const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [normalizedEmail]);
  const user = result.rows[0];

  if (!user) {
    throw new AppError("No existe una cuenta registrada con ese correo.", 404);
  }

  if (user.status === "ACTIVE") {
    return {
      message: "La cuenta ya se encuentra activa.",
      user: { email: user.email }
    };
  }

  if (new Date(user.expires_at).getTime() < Date.now()) {
    throw new AppError(
      "El código ha expirado. Solicite el reenvío de un nuevo código.",
      400
    );
  }

  if (user.verification_attempts >= env.MAX_VERIFICATION_ATTEMPTS) {
    throw new AppError(
      "Se alcanzó el número máximo de intentos. Solicite un nuevo código.",
      429
    );
  }

  if (user.verification_code !== cleanCode) {
    const attempts = user.verification_attempts + 1;

    await pool.query('UPDATE usuarios SET verification_attempts = $1 WHERE email = $2', [attempts, normalizedEmail]);

    const remainingAttempts = Math.max(
      env.MAX_VERIFICATION_ATTEMPTS - attempts,
      0
    );

    throw new AppError(
      `El código es incorrecto. Intentos restantes: ${remainingAttempts}.`,
      400
    );
  }

  const updateResult = await pool.query(`
    UPDATE usuarios 
    SET status = 'ACTIVE', verification_code = NULL, expires_at = NULL, verification_attempts = 0
    WHERE email = $1 RETURNING *;
  `, [normalizedEmail]);

  return {
    message: "Cuenta activada correctamente.",
    user: { email: updateResult.rows[0].email }
  };
}

function getAccountStatus(email) {
  const normalizedEmail = normalizeEmail(email);
  const user = userRepository.findByEmail(normalizedEmail);

  if (!user) {
    throw new AppError("La cuenta no se encuentra registrada.", 404);
  }

  return {
    user: publicUser(user)
  };
}

async function resendVerificationCode(email) {
  const normalizedEmail = normalizeEmail(email);
  const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [normalizedEmail]);
  const user = result.rows[0];

  if (!user) {
    throw new AppError("La cuenta no se encuentra registrada.", 404);
  }

  if (user.status === "ACTIVE") {
    throw new AppError("La cuenta ya se encuentra activa.", 409);
  }

  const verificationCode = generateVerificationCode();
  const expiresAt = createExpirationDate();

  const message = createVerificationEmail({
    name: user.nombre,
    code: verificationCode,
    expirationMinutes: env.CODE_TTL_MINUTES
  });

  queueService.enqueueEmailTask({
    type: "RESEND_VERIFICATION_CODE",
    to: user.email,
    subject: message.subject,
    html: message.html
  });

  await pool.query(`
    UPDATE usuarios SET verification_code = $1, expires_at = $2, verification_attempts = 0
    WHERE email = $3
  `, [verificationCode, expiresAt, normalizedEmail]);

  return {
    message: "Se envió un nuevo código de verificación.",
    codeExpiresAt: expiresAt.toISOString()
  };
}

module.exports = {
  registerUser,
  verifyAccount,
  getAccountStatus,
  resendVerificationCode
};