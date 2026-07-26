const { Resend } = require('resend');
const { env } = require("../config/env");
const { createVerificationEmail } = require("../templates/verification-email.template");
const { createCustomMessageEmail } = require("../templates/custom-message.template");
const { createGiftCodeEmail } = require("../templates/gift-code.template");
const { createReceiptEmail } = require("../templates/receipt-email.template");

// Inicializar el cliente de Resend
const resend = new Resend(process.env.RESEND_API_KEY || env.RESEND_API_KEY);

async function verifyEmailConnection() {
  if (!process.env.RESEND_API_KEY && !env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY no está configurada");
  }
  return true;
}

async function sendEmail({ to, subject, text, html, attachments }) {
  const result = await resend.emails.send({
    from: 'PianoFlow <equipo@pianoflows.shop>', // Remitente oficial de la aplicación
    to,
    subject,
    text,
    html,
    attachments
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
  
  return result;
}

async function sendVerificationEmail({ name, email, code }) {
  const message = createVerificationEmail({
    name,
    code,
    expirationMinutes: env.CODE_TTL_MINUTES
  });

  return sendEmail({
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html
  });
}

async function sendCustomMessage({ to, subject, title, message, signature }) {
  const content = createCustomMessageEmail({
    title,
    message,
    signature
  });

  return sendEmail({
    to,
    subject,
    text: content.text,
    html: content.html
  });
}

async function sendGiftCodeEmail({ to, name, code, durationMonths }) {
  const message = createGiftCodeEmail({
    name,
    code,
    durationMonths
  });

  return sendEmail({
    to,
    subject: message.subject,
    text: message.text,
    html: message.html
  });
}

async function sendReceiptEmail({ to, name, transactionId, items, total, date }) {
  const message = createReceiptEmail({
    name,
    transactionId,
    items,
    total,
    date
  });

  return sendEmail({
    to,
    subject: message.subject,
    text: message.text,
    html: message.html
  });
}

module.exports = {
  verifyEmailConnection,
  sendEmail,
  sendVerificationEmail,
  sendCustomMessage,
  sendGiftCodeEmail,
  sendReceiptEmail
};