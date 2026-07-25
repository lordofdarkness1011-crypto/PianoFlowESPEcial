require("dotenv").config();

const env = {
  PORT: Number(process.env.PORT || 3000),
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD,
  CODE_TTL_MINUTES: Number(process.env.CODE_TTL_MINUTES || 5),
  MAX_VERIFICATION_ATTEMPTS: Number(
    process.env.MAX_VERIFICATION_ATTEMPTS || 5
  ),
  MFA_ISSUER: process.env.MFA_ISSUER || "Aplicaciones Distribuidas",
  MFA_WINDOW: Number(process.env.MFA_WINDOW || 1)
};

function validateEnvironment() {
  const requiredVariables = ["EMAIL_USER", "EMAIL_APP_PASSWORD"];

  const missingVariables = requiredVariables.filter(
    (variableName) => !process.env[variableName]
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Faltan variables de entorno obligatorias: ${missingVariables.join(", ")}`
    );
  }

  if (!Number.isInteger(env.PORT) || env.PORT <= 0) {
    throw new Error("PORT debe ser un número entero positivo.");
  }

  if (!Number.isFinite(env.CODE_TTL_MINUTES) || env.CODE_TTL_MINUTES <= 0) {
    throw new Error("CODE_TTL_MINUTES debe ser un número positivo.");
  }

  if (
    !Number.isInteger(env.MAX_VERIFICATION_ATTEMPTS) ||
    env.MAX_VERIFICATION_ATTEMPTS <= 0
  ) {
    throw new Error("MAX_VERIFICATION_ATTEMPTS debe ser un entero positivo.");
  }

  if (!Number.isInteger(env.MFA_WINDOW) || env.MFA_WINDOW < 0) {
    throw new Error("MFA_WINDOW debe ser un entero mayor o igual a 0.");
  }
}

module.exports = {
  env,
  validateEnvironment
};