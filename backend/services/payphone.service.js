const http2 = require("http2");

function generateClientTransactionId() {
    const base = Date.now().toString(36).toUpperCase();
    return `TX${base}`.substring(0, 15);
}

function cleanText(value, maxLength) {
    return String(value || "")
        .replace(/[^\w\sÁÉÍÓÚáéíóúÑñ.,:-]/g, "")
        .substring(0, maxLength);
}

async function preparePayphonePayment(orderData = {}) {
    const clientTransactionId = generateClientTransactionId();

    const amount = Number(orderData.amount || 200);

    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("El monto debe enviarse como entero en centavos.");
    }

    const body = {
        amount: amount,
        amountWithoutTax: amount,
        clientTransactionId: clientTransactionId,
        currency: "USD",
        reference: cleanText(orderData.reference || "Pago con API Link", 100)
    };

    console.log("[PAYPHONE BODY]", body);

    const responseData = await new Promise((resolve, reject) => {
        const client = http2.connect(process.env.PAYPHONE_BASE_URL, { 
            family: 4,
            secureOptions: require('crypto').constants.SSL_OP_NO_TICKET,
            ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384'
        });
        
        client.on('error', (err) => reject(err));

        const req = client.request({
            ':method': 'POST',
            ':path': '/api/Links',
            'Authorization': `Bearer ${process.env.PAYPHONE_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        });

        req.write(JSON.stringify(body));
        req.end();

        req.setEncoding('utf8');
        let data = '';
        
        req.on('data', (chunk) => { data += chunk; });
        
        req.on('end', () => {
            client.close();
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                resolve(data);
            }
        });
        
        req.on('error', (err) => {
            client.close();
            reject(err);
        });
    });

    return {
        clientTransactionId,
        providerResponse: responseData,
        paymentUrl: responseData
    };
}

module.exports = {
    preparePayphonePayment
};