const { readJsonFile, writeJsonFile } = require('../lib/github');
const { requirePaymentAuth, readJsonBody } = require('../lib/auth');

const ORDERS_PATH = process.env.ORDERS_DATA_PATH || 'pending-orders.json';

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!requirePaymentAuth(req)) {
        res.status(401).json({ error: 'Sesi tidak valid, login ulang.' });
        return;
    }

    const body = await readJsonBody(req);
    const { itemId, qty, nickname, platform } = body || {};

    if (!itemId || !nickname) {
        res.status(400).json({ error: 'itemId dan nickname wajib diisi.' });
        return;
    }

    try {
        const { data, sha } = await readJsonFile(ORDERS_PATH, []);
        const orders = Array.isArray(data) ? data : [];
        const id = 'manual-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

        orders.push({
            id,
            source: 'manual-grant',
            itemId,
            qty: parseInt(qty, 10) || 1,
            nickname,
            platform: platform || 'Java',
            fulfilled: false,
            queuedAt: new Date().toISOString()
        });

        await writeJsonFile(ORDERS_PATH, orders, `Manual grant: ${itemId} -> ${nickname}`, sha);
        res.status(200).json({ ok: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
