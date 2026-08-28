const { createToken, readJsonBody } = require('../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const validUser = process.env.ADMIN_USERNAME;
    const validPass = process.env.ADMIN_PASSWORD;
    const secret = process.env.ADMIN_SECRET;

    if (!validUser || !validPass || !secret) {
        res.status(500).json({ error: 'Server belum di-setup. Isi ADMIN_USERNAME, ADMIN_PASSWORD, dan ADMIN_SECRET di Vercel → Project Settings → Environment Variables.' });
        return;
    }

    const body = await readJsonBody(req);
    const { username, password } = body || {};

    if (username === validUser && password === validPass) {
        const token = createToken(username);
        res.status(200).json({ token });
        return;
    }

    res.status(401).json({ error: 'Username atau password salah.' });
};
