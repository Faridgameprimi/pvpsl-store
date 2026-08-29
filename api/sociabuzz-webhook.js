const { readJsonFile, writeJsonFile } = require('../lib/github');
const { readJsonBody } = require('../lib/auth');

const ORDERS_PATH = process.env.ORDERS_DATA_PATH || 'pending-orders.json';

/* Sociabuzz's exact webhook field names aren't fully documented publicly,
   so we defensively check several likely spots for the token and the
   supporter's note/message instead of assuming one fixed schema. */
function extractToken(req, body) {
    return (
        req.headers['x-webhook-token'] ||
        req.headers['x-sociabuzz-token'] ||
        body.webhook_token ||
        body.token ||
        ''
    );
}

function extractNote(body) {
    const candidates = [
        body.message, body.note, body.comment, body.supporter_message,
        body.donation_message, body.msg, body.description
    ];
    return candidates.find(v => typeof v === 'string' && v.trim().length > 0) || '';
}

function extractSupporterName(body) {
    const candidates = [body.supporter_name, body.name, body.donator_name, body.from, body.sender_name];
    return candidates.find(v => typeof v === 'string' && v.trim().length > 0) || '';
}

function extractAmount(body) {
    const candidates = [body.amount, body.price, body.nominal, body.total, body.amount_raw];
    const found = candidates.find(v => v !== undefined && v !== null);
    return found !== undefined ? found : null;
}

/* Our purchase modal asks buyers to paste a tag like:
   [FARIDSMP-ORDER] item=weekly-plus-pass;qty=1;nick=Steve123;platform=Java */
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

    const body = await readJsonBody(req);
    const receivedToken = extractToken(req, body);

    if (receivedToken !== expectedToken) {
        res.status(401).json({ error: 'Webhook token tidak cocok.' });
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
        // Still notify Discord even if the queue write failed, so nothing gets silently lost.
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
