const { escapeHtml } = require("../utils/html.util");

function createVerificationEmail({ name, code, expirationMinutes }) {
    const safeName = escapeHtml(name);
    const safeCode = escapeHtml(code);
    const expirationText = `${expirationMinutes} minuto(s)`;

    const subject = `${safeCode} es su código de activación`;

    const text = [
        `¡Hola ${name}!`,
        "",
        "Bienvenido a PianoFlow. Se solicitó la activación de una cuenta con este correo.",
        `Tu código de verificación es: ${code}`,
        `Este código caducará en ${expirationText}.`,
        "",
        "Si no creaste esta cuenta, puedes ignorar este mensaje tranquilamente.",
        "",
        "El equipo de PianoFlow 🎹"
    ].join("\n");

    const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Activación de cuenta - PianoFlow</title>
      </head>
      <body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;color:#f8fafc;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f172a;">
          <tr>
            <td align="center" style="padding:32px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#1e293b;border-radius:14px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,0.5); border: 1px solid #334155;">
                <tr>
                  <td align="center" style="padding:30px 24px;background:#000000; border-bottom: 2px solid gold;">
                    <div style="font-size: 40px; margin-bottom: 10px;">🎹</div>
                    <h1 style="margin:0;color:gold;font-size:26px; letter-spacing: 1px;">PianoFlow</h1>
                    <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">Aprende y toca con ritmo</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 34px 22px;">
                    <p style="margin:0 0 18px;font-size:17px;line-height:1.6;color:#e2e8f0;">¡Hola <strong>${safeName}</strong>!</p>
                    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#cbd5e1;">Estás a un paso de empezar a tocar. Hemos recibido una solicitud para activar tu cuenta. Por favor, ingresa el siguiente código para afinar los últimos detalles:</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="padding:24px 12px;background:#0f172a;border:1px solid gold;border-radius:12px;">
                          <p style="margin:0 0 8px;color:#cbd5e1;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Código de verificación</p>
                          <p style="margin:0;color:gold;font-size:38px;font-weight:700;letter-spacing:9px;line-height:1.3;">${safeCode}</p>
                        </td>
                      </tr>
                    </table>
                    <div style="margin-top:22px;padding:14px 16px;background:rgba(255, 215, 0, 0.1);border-left:4px solid gold;border-radius:6px;">
                      <p style="margin:0;color:#fef08a;font-size:14px;line-height:1.5;">Este código perderá el ritmo en <strong>${expirationText}</strong>.</p>
                    </div>
                    <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#94a3b8;">Por tu seguridad, no compartas esta clave. Si no creaste esta cuenta, ignora este correo.</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:22px;background:#020617;border-top:1px solid #1e293b;">
                    <p style="margin:0 0 5px;color:gold;font-size:13px;font-weight:700;">PianoFlow Team</p>
                    <p style="margin:0;color:#475569;font-size:12px;">Este es un mensaje automático, por favor no respondas a este correo.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

    return { subject, text, html };
}

module.exports = {
    createVerificationEmail
};