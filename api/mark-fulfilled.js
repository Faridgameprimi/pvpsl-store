const { readJsonFile, writeJsonFile } = require('../lib/github');
const { requirePluginKey, readJsonBody } = require('../lib/auth');

const ORDERS_PATH = process.env.ORDERS_DATA_PATH || 'pending-orders.json';

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!requirePluginKey(req)) {
        res.status(401).json({ error: 'Plugin key tidak valid.' });
        return;
    }

    const body = await readJsonBody(req);
    const { id } = body || {};
    if (!id) {
        res.status(400).json({ error: 'id wajib diisi.' });
        return;
    }

    try {
        const { data, sha } = await readJsonFile(ORDERS_PATH, []);
        const orders = Array.isArray(data) ? data : [];
        const order = orders.find(o => o.id === id);
        if (!order) {
            res.status(404).json({ error: 'Order tidak ditemukan (mungkin sudah pernah ditandai).' });
            return;
        }
        order.fulfilled = true;
        order.fulfilledAt = new Date().toISOString();
        await writeJsonFile(ORDERS_PATH, orders, `Order ${id} fulfilled oleh plugin`, sha);
        res.status(200).json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
