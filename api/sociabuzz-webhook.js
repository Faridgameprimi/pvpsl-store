const { readJsonFile, writeJsonFile } = require('../lib/github');
const { readJsonBody } = require('../lib/auth');

const ORDERS_PATH = process.env.ORDERS_DATA_PATH || 'pending-orders.json';

function extractToken(req, body) {
    return (
        req.headers['x-webhook-token'] ||
        req.headers['x-sociabuzz-token'] ||
        (req.query && (req.query.token || req.query.webhook_token)) ||
        body?.webhook_token ||
        body?.token ||
        body?.secret ||
        ''
    );
}

function extractNote(body) {
    const candidates = [
        body?.message, body?.note, body?.comment, body?.supporter_message,
        body?.donation_message, body?.msg, body?.description
    ];
    return candidates.find(v => typeof v === 'string' && v.trim().length > 0) || '';
}

function extractSupporterName(body) {
    const candidates = [body?.supporter_name, body?.name, body?.donator_name, body?.from, body?.sender_name];
    return candidates.find(v => typeof v === 'string' && v.trim().length > 0) || '';
}

function extractAmount(body) {
    const candidates = [body?.amount, body?.price, body?.nominal, body?.total, body?.amount_raw];
    const found = candidates.find(v => v !== undefined && v !== null);
    return found !== undefined ? found : null;
}

function parseOrderTag(note) {
    const match = note.match(/\[FARIDSMP-ORDER\]\s*(.+)/i);
    if (!match) return null;

    const pairs = {};
    match[1].split(';').forEach(part => {
        const [k, v] = part.split('=').map(s => (s || '').trim());
        if (k && v !== undefined) pairs[k.toLowerCase()] = v;
    });

    if (!pairs.item || !pairs.nick) return null;

    return {
        itemId: pairs.item,
        qty: parseInt(pairs.qty, 10) || 1,
        nickname: pairs.nick,
        platform: pairs.platform || 'Java'
    };
}

async function notifyDiscord(text, color) {
    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (!webhook) return;
    try {
        await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [{ description: text, color: color || 5793266, timestamp: new Date().toISOString() }] })
        });
    } catch (e) { /* ignore */ }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const expectedToken = process.env.SOCIABUZZ_WEBHOOK_TOKEN;
    if (!expectedToken) {
        res.status(500).json({ error: 'Server belum di-setup: SOCIABUZZ_WEBHOOK_TOKEN env var belum diisi.' });
        return;
    }

    // Ambil data req.body jika Vercel sudah auto-parse, jika tiada baru gunakan readJsonBody
    let body = req.body;
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
        try {
            body = await readJsonBody(req);
        } catch (e) {
            body = {};
        }
    }

    const receivedToken = extractToken(req, body);

    // Debugging Log di Vercel (untuk menyemak data sebenar dari SociaBuzz)
    console.log('--- SOCIABUZZ WEBHOOK DEBUG ---');
    console.log('Received Token:', receivedToken);
    console.log('Expected Token:', expectedToken);
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body:', JSON.stringify(body));

    if (receivedToken !== expectedToken) {
        res.status(401).json({ 
            error: 'Webhook token tidak cocok.',
            received: receivedToken ? 'ADA (tetapi tidak sepadan)' : 'KOSONG/TIDAK DIJUMPAI'
        });
        return;
    }

    const note = extractNote(body);
    const supporterName = extractSupporterName(body);
    const amount = extractAmount(body);
    const parsed = parseOrderTag(note);

    const order = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        source: 'sociabuzz',
        receivedAt: new Date().toISOString(),
        fulfilled: false,
        amount,
        supporterName,
        rawNote: note,
        itemId: parsed ? parsed.itemId : null,
        qty: parsed ? parsed.qty : 1,
        nickname: parsed ? parsed.nickname : supporterName,
        platform: parsed ? parsed.platform : null,
        needsReview: !parsed
    };

    try {
        const { data, sha } = await readJsonFile(ORDERS_PATH, []);
        const orders = Array.isArray(data) ? data : [];
        orders.push(order);
        await writeJsonFile(ORDERS_PATH, orders, `Order baru dari Sociabuzz (${order.nickname || 'unknown'})`, sha);
    } catch (err) {
        await notifyDiscord(`⚠️ Order masuk dari Sociabuzz tapi GAGAL disimpan ke queue: ${err.message}\nNote asli: ${note || '(kosong)'}`, 15548997);
        res.status(500).json({ error: err.message });
        return;
    }

    if (order.needsReview) {
        await notifyDiscord(
            `⚠️ **Order dari Sociabuzz — perlu cek manual** (format tag tidak ketemu di catatan)\n` +
            `Supporter: ${supporterName || '-'}\nAmount: ${amount ?? '-'}\nCatatan: ${note || '(kosong)'}`,
            15548997
        );
    } else {
        await notifyDiscord(
            `✅ **Order baru — masuk antrian delivery otomatis**\n` +
            `Item: \`${order.itemId}\` x${order.qty}\nNickname: **${order.nickname}** (${order.platform})`,
            5793266
        );
    }

    res.status(200).json({ ok: true, queued: !order.needsReview });
};
