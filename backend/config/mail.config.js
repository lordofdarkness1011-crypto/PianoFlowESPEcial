const nodemailer = require("nodemailer");
const { env } = require("./env");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // port 587 usa TLS (STARTTLS), por lo que secure debe ser false
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_APP_PASSWORD?.replace(/\s/g, "")
  }
});

module.exports = transporter;