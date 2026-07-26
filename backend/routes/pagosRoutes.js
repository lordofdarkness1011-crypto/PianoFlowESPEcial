const express = require("express");
const router = express.Router();
const pool = require("../utils/db");
const { requireAuth } = require("../middlewares/jwtMiddleware");
const crypto = require("crypto");
const emailService = require("../services/email.service");

const {
    createPaypalOrder,
    capturePaypalOrder
} = require("../services/paypal.service");

const {
    preparePayphonePayment
} = require("../services/payphone.service");

// ==========================================
// PAYPAL
// ==========================================
router.get("/paypal/config", requireAuth, (req, res) => {
    res.json({ clientId: process.env.PAYPAL_CLIENT_ID });
});

// Endpoint para que la ventana emergente se cierre sola tras pagar
router.get("/paypal/success", (req, res) => {
    res.send("<script>window.close();</script>");
});

router.post("/paypal/create-order", requireAuth, async (req, res) => {
    try {
        const orderData = req.body;
        
        let amount = 999; // $9.99 (mensual / regalo 1 mes)
        let description = "Suscripción Premium PianoFlow (1 Mes)";
        
        if (orderData.tipoCompra === 'regalo_1_anio') {
            amount = 9999; // $99.99
            description = "Código de Regalo Premium PianoFlow (1 Año)";
        } else if (orderData.tipoCompra === 'regalo_1_mes') {
            description = "Código de Regalo Premium PianoFlow (1 Mes)";
        }

        orderData.amount = amount;
        orderData.reference = description;

        const order = await createPaypalOrder(orderData);
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: "Error creando orden PayPal" });
    }
});

router.post("/paypal/capture-order/:orderId", requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { tipoCompra } = req.body; // 'directo', 'regalo_1_mes', 'regalo_1_anio'
        
        const capture = await capturePaypalOrder(orderId);

        if (capture.status === "COMPLETED") {
            const userId = req.user.id;
            
            // Determinar monto pagado leyendo la respuesta de captura
            const capturedAmount = parseFloat(capture.purchase_units[0].payments.captures[0].amount.value);
            let meses = 1;
            if (capturedAmount >= 99.00) {
                meses = 12;
            }

            const userRes = await pool.query("SELECT email, nombre FROM usuarios WHERE id = $1", [userId]);
            const userDb = userRes.rows[0];

            if (tipoCompra === 'regalo_1_mes' || tipoCompra === 'regalo_1_anio') {
                // Generar código de regalo
                const code = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 caracteres
                
                await pool.query(
                    `INSERT INTO codigos_regalo (codigo, duracion_meses, comprador_id, fecha_expiracion)
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '3 months')`,
                    [code, meses, userId]
                );

                // Enviar código por correo
                await emailService.sendGiftCodeEmail({
                    to: userDb.email,
                    name: userDb.nombre,
                    code: code,
                    durationMonths: meses
                });

            } else {
                // Compra directa mensual
                await pool.query(
                    `UPDATE usuarios SET 
                        tipo_suscripcion = 'premium', 
                        premium_expires_at = CASE WHEN premium_expires_at > CURRENT_TIMESTAMP THEN premium_expires_at ELSE CURRENT_TIMESTAMP END + INTERVAL '1 month' 
                     WHERE id = $1`,
                    [userId]
                );
            }
            
            // Enviar recibo de pago para todos
            const itemDesc = tipoCompra === 'regalo_1_anio' ? 'Código de Regalo Premium PianoFlow (1 Año)' : 
                             tipoCompra === 'regalo_1_mes' ? 'Código de Regalo Premium PianoFlow (1 Mes)' : 
                             'Suscripción Premium PianoFlow (1 Mes)';
                             
            await emailService.sendReceiptEmail({
                to: userDb.email,
                name: userDb.nombre,
                transactionId: capture.id,
                items: [{ description: itemDesc, price: capturedAmount }],
                total: capturedAmount,
                date: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            });

        }

        res.json(capture);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error capturando orden PayPal" });
    }
});

// ==========================================
// CANJEAR CÓDIGO
// ==========================================
router.post("/redeem-code", requireAuth, async (req, res) => {
    try {
        const { codigo } = req.body;
        const userId = req.user.id;

        // Iniciar transacción
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const codeRes = await client.query(
                "SELECT * FROM codigos_regalo WHERE codigo = $1 FOR UPDATE", 
                [codigo.toUpperCase()]
            );

            if (codeRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: "Código no encontrado" });
            }

            const codeData = codeRes.rows[0];

            if (codeData.estado === 'usado') {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "Este código ya ha sido usado" });
            }

            if (new Date() > new Date(codeData.fecha_expiracion)) {
                // Marcar como expirado si no lo estaba
                await client.query("UPDATE codigos_regalo SET estado = 'expirado' WHERE id = $1", [codeData.id]);
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "Este código ha expirado (pasaron más de 3 meses)" });
            }

            // Canje exitoso
            await client.query(
                "UPDATE codigos_regalo SET estado = 'usado', usuario_redencion_id = $1, fecha_uso = CURRENT_TIMESTAMP WHERE id = $2",
                [userId, codeData.id]
            );

            await client.query(
                `UPDATE usuarios SET 
                    tipo_suscripcion = 'premium', 
                    premium_expires_at = COALESCE(
                        CASE WHEN premium_expires_at > CURRENT_TIMESTAMP THEN premium_expires_at ELSE CURRENT_TIMESTAMP END, 
                        CURRENT_TIMESTAMP
                    ) + ($1 || ' months')::interval
                 WHERE id = $2`,
                [codeData.duracion_meses, userId]
            );

            await client.query('COMMIT');
            res.json({ success: true, message: "¡Código canjeado con éxito! Eres Premium." });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al canjear el código" });
    }
});

// ==========================================
// PAYPHONE
// ==========================================
router.post("/payphone/prepare", requireAuth, async (req, res) => {
    try {
        // En Payphone, necesitamos procesar la respuesta del webhook para dar el premium
        // Pero para simplificar en esta demostración interactiva de prueba:
        const result = await preparePayphonePayment({
            ...req.body,
            amount: 999, // Fijo a premium
            tax: 0,
            amountWithoutTax: 999
        });

        res.json({
            ok: true,
            provider: "PAYPHONE",
            clientTransactionId: result.clientTransactionId,
            paymentUrl: result.paymentUrl
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            message: "Error preparando pago PayPhone",
            detail: error.response?.data || error.message
        });
    }
});

// Payphone normalmente manda un webhook (Server to Server) para confirmar el pago.
// Este endpoint simulará la recepción para subir a premium.
router.post("/payphone/confirm", requireAuth, async (req, res) => {
    try {
        // Asumiendo que el cliente validó la url de respuesta exitosa
        const userId = req.user.id;
        await pool.query(
            "UPDATE usuarios SET tipo_suscripcion = 'premium' WHERE id = $1",
            [userId]
        );
        res.json({ ok: true, message: "Suscripción Premium activada" });
    } catch (error) {
        res.status(500).json({ ok: false, message: "Error confirmando Payphone" });
    }
});

module.exports = router;
