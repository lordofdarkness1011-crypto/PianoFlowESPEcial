const transporter = require("../config/mail.config");
const { env } = require("../config/env");
const {
  createVerificationEmail
} = require("../templates/verification-email.template");
const {
  createCustomMessageEmail
} = require("../templates/custom-message.template");

async function verifyEmailConnection() {
  return transporter.verify();
}

async function sendEmail({ to, subject, text, html, attachments }) {
  return transporter.sendMail({
    from: `"Aplicaciones Distribuidas" <${env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
    attachments
  });
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

module.exports = {
  verifyEmailConnection,
  sendEmail,
  sendVerificationEmail,
  sendCustomMessage
};