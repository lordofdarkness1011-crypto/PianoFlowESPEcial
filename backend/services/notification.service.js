const emailService = require("./email.service");
const queueService = require("./queue.service");
const { createCustomMessageEmail } = require("../templates/custom-message.template");
const { normalizeEmail, isValidEmail } = require("../utils/email.util");
const AppError = require("../utils/app-error");

async function sendCustomNotification({
    to,
    subject,
    title,
    message,
    signature,
    attachments
}) {
    const normalizedEmail = normalizeEmail(to);
    const cleanSubject = String(subject || "").trim();
    const cleanTitle = String(title || "").trim();
    const cleanMessage = String(message || "").trim();
    const cleanSignature = String(signature || "").trim();

    if (!normalizedEmail || !cleanSubject || !cleanTitle || !cleanMessage) {
        throw new AppError(
            "El destinatario, el asunto, el título y el mensaje son obligatorios.",
            400
        );
    }

    if (!isValidEmail(normalizedEmail)) {
        throw new AppError("El correo del destinatario es incorrecto.", 400);
    }

    if (cleanSubject.length > 120) {
        throw new AppError("El asunto no puede superar 120 caracteres.", 400);
    }

    if (cleanTitle.length > 100) {
        throw new AppError("El título no puede superar 100 caracteres.", 400);
    }

    if (cleanMessage.length > 3000) {
        throw new AppError("El mensaje no puede superar 3000 caracteres.", 400);
    }

    const content = createCustomMessageEmail({
        title: cleanTitle,
        message: cleanMessage,
        signature: cleanSignature || "Aplicaciones Distribuidas"
    });

    const task = queueService.enqueueEmailTask({
        type: "CUSTOM_NOTIFICATION",
        to: normalizedEmail,
        subject: cleanSubject,
        html: content.html,
        attachments: attachments || []
    });

    return {
        message: "Correo dinámico encolado correctamente.",
        recipient: normalizedEmail,
        taskId: task.id
    };
}

module.exports = {
    sendCustomNotification
};