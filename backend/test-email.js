require("dotenv").config();
const emailService = require("./services/email.service");

async function run() {
    try {
        console.log("Probando el envío de correo usando email.service.js...");
        await emailService.sendVerificationEmail({
            name: "Usuario Local",
            email: process.env.EMAIL_USER, // Se lo enviará a tu propio correo
            code: "777777"
        });
        console.log("✅ ¡Correo enviado exitosamente! Revisa tu bandeja de entrada de", process.env.EMAIL_USER);
    } catch (err) {
        console.error("❌ Falló el envío del correo:", err.message);
    }
}
run();
