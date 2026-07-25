const nodemailer = require("nodemailer");
const { env } = require("./env");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_APP_PASSWORD?.replace(/\s/g, "")
  }
});

module.exports = transporter;