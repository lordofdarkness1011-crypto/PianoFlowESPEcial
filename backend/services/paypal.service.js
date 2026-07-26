const axios = require("axios");

function basicAuth() {
    const credentials = `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`;
    return Buffer.from(credentials).toString("base64");
}

async function getAccessToken() {
    const response = await axios.post(
        `${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`,
        "grant_type=client_credentials",
        {
            headers: {
                Authorization: `Basic ${basicAuth()}`,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }
    );

    return response.data.access_token;
}

async function createPaypalOrder(orderData = {}) {
    const token = await getAccessToken();

    const amountInCents = Number(orderData.amount || 200);
    const amountInDollars = (amountInCents / 100).toFixed(2);
    const description = orderData.reference || "Laboratorio intercambio de mensajes";

    const body = {
        intent: "CAPTURE",
        purchase_units: [
            {
                amount: {
                    currency_code: "USD",
                    value: amountInDollars
                },
                description: description.substring(0, 127)
            }
        ],
        application_context: {
            return_url: `${process.env.API_URL || 'https://pianoflowbackend.onrender.com'}/api/pagos/paypal/success`,
            cancel_url: `${process.env.API_URL || 'https://pianoflowbackend.onrender.com'}/api/pagos/paypal/success`,
            user_action: "PAY_NOW"
        }
    };

    const response = await axios.post(
        `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
        body,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        }
    );

    return response.data;
}

async function capturePaypalOrder(orderId) {
    const token = await getAccessToken();

    const response = await axios.post(
        `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        }
    );

    return response.data;
}

module.exports = {
    createPaypalOrder,
    capturePaypalOrder
};