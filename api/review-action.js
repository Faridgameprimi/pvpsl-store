const { readJsonFile, writeJsonFile } = require('../lib/github');
const { requirePaymentAuth, readJsonBody } = require('../lib/auth');

const REVIEW_PATH = process.env.REVIEW_DATA_PATH || 'payment-review.json';
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
    const { id, action, overrides } = body || {};

    if (!id || !['accept', 'deny'].includes(action)) {
        res.status(400).json({ error: 'id dan action ("accept"/"deny") wajib diisi.' });
        return;
    }

    try {
        const { data, sha } = await readJsonFile(REVIEW_PATH, []);
        const reviews = Array.isArray(data) ? data : [];
        const review = reviews.find(r => r.id === id);

        if (!review) {
            res.status(404).json({ error: 'Order tidak ditemukan.' });
            return;
        }
        if (review.status !== 'pending') {
            res.status(409).json({ error: `Order ini sudah di-${review.status === 'accepted' ? 'accept' : 'deny'} sebelumnya.` });
            return;
        }

        if (action === 'deny') {
            review.status = 'denied';
            review.deniedAt = new Date().toISOString();
            await writeJsonFile(REVIEW_PATH, reviews, `Deny order ${id}`, sha);
            res.status(200).json({ ok: true });
            return;
        }

        // action === 'accept'
        const finalItemId = (overrides && overrides.itemId) || review.itemId;
        const finalQty = (overrides && overrides.qty) ? parseInt(overrides.qty, 10) : (review.qty || 1);
        const finalNickname = (overrides && overrides.nickname) || review.nickname;
        const finalPlatform = (overrides && overrides.platform) || review.platform || 'Java';

        if (!finalItemId || !finalNickname) {
            res.status(400).json({ error: 'Item dan nickname wajib diisi (isi lewat form koreksi kalau kode order tidak ke-detect).' });
            return;
        }

        review.status = 'accepted';
        review.acceptedAt = new Date().toISOString();
        review.finalItemId = finalItemId;
        review.finalQty = finalQty;
        review.finalNickname = finalNickname;
        review.finalPlatform = finalPlatform;

        await writeJsonFile(REVIEW_PATH, reviews, `Accept order ${id}`, sha);

        // Now push into the delivery queue the Minecraft plugin polls.
        const { data: ordersData, sha: ordersSha } = await readJsonFile(ORDERS_PATH, []);
        const orders = Array.isArray(ordersData) ? ordersData : [];
        orders.push({
            id: `rev-${id}`,
            source: 'payment-admin',
            reviewId: id,
            itemId: finalItemId,
            qty: finalQty,
            nickname: finalNickname,
            platform: finalPlatform,
            fulfilled: false,
            queuedAt: new Date().toISOString()
        });
        await writeJsonFile(ORDERS_PATH, orders, `Queue delivery for accepted order ${id}`, ordersSha);

        res.status(200).json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
