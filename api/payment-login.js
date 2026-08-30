const { createToken, readJsonBody } = require('../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const validUser = process.env.PAYMENT_ADMIN_USERNAME;
    const validPass = process.env.PAYMENT_ADMIN_PASSWORD;
    const secret = process.env.PAYMENT_ADMIN_SECRET;

    if (!validUser || !validPass || !secret) {
        res.status(500).json({ error: 'Server belum di-setup. Isi PAYMENT_ADMIN_USERNAME, PAYMENT_ADMIN_PASSWORD, dan PAYMENT_ADMIN_SECRET di Vercel → Project Settings → Environment Variables.' });
        return;
    }

    const body = await readJsonBody(req);
    const { username, password } = body || {};

    if (username === validUser && password === validPass) {
        const token = createToken(username, secret);
        res.status(200).json({ token });
        return;
    }

    res.status(401).json({ error: 'Username atau password salah.' });
};
