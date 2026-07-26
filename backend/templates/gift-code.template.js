function createGiftCodeEmail({ name, code, durationMonths }) {
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 3);
    const dateStr = expirationDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tu Código de Regalo Premium - PianoFlow</title>
      </head>
      <body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;color:#f8fafc;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f172a;">
          <tr>
            <td align="center" style="padding:32px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#1e293b;border-radius:14px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,0.5); border: 1px solid #334155;">
                <tr>
                  <td align="center" style="padding:30px 24px;background:#000000; border-bottom: 2px solid gold;">
                    <div style="font-size: 40px; margin-bottom: 10px;">🎁</div>
                    <h1 style="margin:0;color:gold;font-size:26px; letter-spacing: 1px;">PianoFlow Premium</h1>
                    <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">¡Has comprado un regalo musical!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 34px 22px;">
                    <p style="margin:0 0 18px;font-size:17px;line-height:1.6;color:#e2e8f0;">¡Hola <strong>${name}</strong>!</p>
                    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#cbd5e1;">Gracias por adquirir un Código de Regalo Premium por <strong>${durationMonths} ${durationMonths === 1 ? 'mes' : 'meses'}</strong>. Aquí tienes tu código para que se lo envíes a esa persona especial (o para que lo uses tú mismo):</p>
                    
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="padding:24px 12px;background:#0f172a;border:1px solid gold;border-radius:12px;">
                          <p style="margin:0 0 8px;color:#cbd5e1;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">CÓDIGO DE REGALO</p>
                          <p style="margin:0;color:gold;font-size:32px;font-weight:700;letter-spacing:5px;line-height:1.3; font-family: monospace;">${code}</p>
                        </td>
                      </tr>
                    </table>

                    <div style="margin-top:22px;padding:14px 16px;background:rgba(255, 215, 0, 0.1);border-left:4px solid gold;border-radius:6px;">
                      <p style="margin:0;color:#fef08a;font-size:14px;line-height:1.5;"><strong>Importante:</strong> Este código tiene una validez de 3 meses a partir de hoy. Caducará irrevocablemente el <strong>${dateStr}</strong> si nadie lo canjea antes de esa fecha.</p>
                    </div>

                    <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#94a3b8;"><strong>¿Cómo canjearlo?</strong><br>Dile al afortunado que inicie sesión en PianoFlow, vaya a su perfil, luego a la sección Premium, e ingrese el código de 12 dígitos en la casilla de canje.</p>
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

    return {
        subject: `🎁 Tu código de regalo PianoFlow de ${durationMonths} ${durationMonths === 1 ? 'mes' : 'meses'} está listo`,
        text: `Hola ${name},\n\nGracias por comprar un código de regalo Premium de ${durationMonths} meses. Tu código es: ${code}\n\nRecuerda que debes canjearlo antes del ${dateStr} o caducará.\n\nPara canjearlo, el usuario debe ir a la sección Premium en PianoFlow e ingresar el código.\n\nEl equipo de PianoFlow.`,
        html: html
    };
}

module.exports = {
    createGiftCodeEmail
};
