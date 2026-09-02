const crypto = require('crypto');

function sign(payloadB64, secret) {
    return crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
}

function createToken(username, secret) {
    const expiry = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
    const payload = `${username}:${expiry}`;
    const payloadB64 = Buffer.from(payload).toString('base64');
    const signature = sign(payloadB64, secret);
    return `${payloadB64}.${signature}`;
}

function verifyToken(token, secret) {
    if (!token || !secret) return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;

    const expected = sign(payloadB64, secret);
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = Buffer.from(payloadB64, 'base64').toString('utf8');
    const [username, expiryStr] = payload.split(':');
    const expiry = parseInt(expiryStr, 10);
    if (!expiry || Date.now() > expiry) return null;

    return { username };
}

/** Site admin (store/rank/key management). Signed with ADMIN_SECRET. */
function requireAuth(req) {
    const header = req.headers.authorization || '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    return verifyToken(token, process.env.ADMIN_SECRET);
}

/** Payment admin (order review/manual grant). Signed with PAYMENT_ADMIN_SECRET — a
    completely separate secret, so a site-admin token can never be used here or vice versa. */
function requirePaymentAuth(req) {
    const header = req.headers.authorization || '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    return verifyToken(token, process.env.PAYMENT_ADMIN_SECRET);
}

function requirePluginKey(req) {
    const expected = process.env.PLUGIN_API_KEY;
    if (!expected) return false;
    const provided = req.headers['x-plugin-key'] || '';
    if (!provided) return false;
    const a = Buffer.from(String(provided));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
        try { return JSON.parse(req.body); } catch (e) { return {}; }
    }
    return new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
}

module.exports = { createToken, verifyToken, requireAuth, requirePaymentAuth, requirePluginKey, readJsonBody };
