function createReceiptEmail({ name, transactionId, items, total, date }) {
    const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recibo de Pago - PianoFlow</title>
      </head>
      <body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;color:#f8fafc;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f172a;">
          <tr>
            <td align="center" style="padding:32px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#1e293b;border-radius:14px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,0.5); border: 1px solid #334155;">
                <tr>
                  <td align="center" style="padding:30px 24px;background:#000000; border-bottom: 2px solid #3b82f6;">
                    <div style="font-size: 40px; margin-bottom: 10px;">🧾</div>
                    <h1 style="margin:0;color:#3b82f6;font-size:26px; letter-spacing: 1px;">PianoFlow</h1>
                    <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">Recibo de Pago Confirmado</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 34px 22px;">
                    <p style="margin:0 0 18px;font-size:17px;line-height:1.6;color:#e2e8f0;">¡Hola <strong>${name}</strong>!</p>
                    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#cbd5e1;">Hemos recibido tu pago con éxito. A continuación, encontrarás los detalles de tu transacción:</p>
                    
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px;">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:14px;">Transacción ID:</td>
                        <td align="right" style="padding:8px 0;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:14px;font-family:monospace;">${transactionId}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:14px;">Fecha:</td>
                        <td align="right" style="padding:8px 0;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:14px;">${date}</td>
                      </tr>
                      ${items.map(item => `
                      <tr>
                        <td style="padding:12px 0;border-bottom:1px solid #1e293b;color:#cbd5e1;font-size:15px;">${item.description}</td>
                        <td align="right" style="padding:12px 0;border-bottom:1px solid #1e293b;color:#cbd5e1;font-size:15px;">$${item.price.toFixed(2)}</td>
                      </tr>
                      `).join('')}
                      <tr>
                        <td style="padding:16px 0 0;color:#f8fafc;font-size:18px;font-weight:bold;">Total Pagado:</td>
                        <td align="right" style="padding:16px 0 0;color:#10b981;font-size:20px;font-weight:bold;">$${total.toFixed(2)} USD</td>
                      </tr>
                    </table>

                    <div style="margin-top:22px;padding:14px 16px;background:rgba(59, 130, 246, 0.1);border-left:4px solid #3b82f6;border-radius:6px;">
                      <p style="margin:0;color:#93c5fd;font-size:14px;line-height:1.5;">Este recibo es un comprobante de pago oficial de tu suscripción o compra en PianoFlow.</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:22px;background:#020617;border-top:1px solid #1e293b;">
                    <p style="margin:0 0 5px;color:#3b82f6;font-size:13px;font-weight:700;">PianoFlow Team</p>
                    <p style="margin:0;color:#475569;font-size:12px;">Este es un mensaje automático generado por nuestro sistema de facturación.</p>
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
        subject: `🧾 Recibo de Pago - PianoFlow (ID: ${transactionId})`,
        text: `Hola ${name},\n\nHemos recibido tu pago con éxito.\n\nDetalles de la transacción:\nID: ${transactionId}\nFecha: ${date}\nTotal: $${total.toFixed(2)} USD\n\nGracias por confiar en PianoFlow.`,
        html: html
    };
}

module.exports = {
    createReceiptEmail
};
