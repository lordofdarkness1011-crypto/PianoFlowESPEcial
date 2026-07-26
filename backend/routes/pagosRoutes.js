const express = require("express");
const router = express.Router();
const pool = require("../utils/db");
const { requireAuth } = require("../middlewares/jwtMiddleware");

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
        // Se puede forzar que el monto sea fijo para Premium
        orderData.amount = 999; // $9.99 por ejemplo
        const order = await createPaypalOrder(orderData);
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: "Error creando orden PayPal" });
    }
});

router.post("/paypal/capture-order/:orderId", requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const capture = await capturePaypalOrder(orderId);

        if (capture.status === "COMPLETED") {
            // Actualizar usuario a Premium
            const userId = req.user.id;
            await pool.query(
                "UPDATE usuarios SET tipo_suscripcion = 'premium' WHERE id = $1",
                [userId]
            );
        }

        res.json(capture);
    } catch (error) {
        res.status(500).json({ message: "Error capturando orden PayPal" });
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
