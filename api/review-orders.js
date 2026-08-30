const { readJsonFile } = require('../lib/github');
const { requirePaymentAuth } = require('../lib/auth');

const REVIEW_PATH = process.env.REVIEW_DATA_PATH || 'payment-review.json';

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!requirePaymentAuth(req)) {
        res.status(401).json({ error: 'Sesi tidak valid, login ulang.' });
        return;
    }

    try {
        const { data } = await readJsonFile(REVIEW_PATH, []);
        const reviews = Array.isArray(data) ? data : [];
        // Most recent first
        reviews.sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || ''));
        res.status(200).json({ reviews });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
