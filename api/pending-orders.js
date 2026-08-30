const { readJsonFile } = require('../lib/github');
const { requirePluginKey } = require('../lib/auth');

const ORDERS_PATH = process.env.ORDERS_DATA_PATH || 'pending-orders.json';

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!requirePluginKey(req)) {
        res.status(401).json({ error: 'Plugin key tidak valid.' });
        return;
    }

    try {
        const { data } = await readJsonFile(ORDERS_PATH, []);
        const orders = Array.isArray(data) ? data : [];
        const pending = orders.filter(o => !o.fulfilled && o.itemId);
        res.status(200).json({ orders: pending });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
