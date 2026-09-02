const { readJsonFile, writeJsonFile } = require('../lib/github');
const { readJsonBody } = require('../lib/auth');

const REVIEW_PATH = process.env.REVIEW_DATA_PATH || 'payment-review.json';

/* Sociabuzz's exact webhook field names aren't fully documented publicly,
   so we defensively check several likely spots for the token and the
   supporter's name/message instead of assuming one fixed schema. */
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

/* Buyers are told: Java = plain gamertag ("andi"), Bedrock = underscore
   prefix ("_andi"). We use that to guess platform + real nickname —
   admin can still correct it in Payment Admin before accepting. */
function detectPlatform(rawName) {
    const trimmed = (rawName || '').trim();
    if (trimmed.startsWith('_')) {
        return { nickname: trimmed.slice(1), platform: 'Bedrock' };
    }
    return { nickname: trimmed, platform: 'Java' };
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
    const { nickname, platform } = detectPlatform(supporterName);

    // Every order lands here as "pending" — admin reads the name + message
    // and manually picks the matching item, then Accept/Deny. Nothing gets
    // delivered without that human step.
    const review = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        source: 'sociabuzz',
        receivedAt: new Date().toISOString(),
        status: 'pending', // pending | accepted | denied
        amount,
        supporterName,
        rawNote: note,
        itemId: null,
        qty: 1,
        nickname,
        platform
    };

    try {
        const { data, sha } = await readJsonFile(REVIEW_PATH, []);
        const reviews = Array.isArray(data) ? data : [];
        reviews.push(review);
        await writeJsonFile(REVIEW_PATH, reviews, `Order baru dari Sociabuzz (${review.nickname || 'unknown'})`, sha);
    } catch (err) {
        await notifyDiscord(`⚠️ Order masuk dari Sociabuzz tapi GAGAL disimpan: ${err.message}\nPesan: ${note || '(kosong)'}`, 15548997);
        res.status(500).json({ error: err.message });
        return;
    }

    await notifyDiscord(
        `💰 **Order baru dari Sociabuzz — menunggu verifikasi admin**\n` +
        `Nama: **${supporterName || '-'}** → terdeteksi: ${nickname || '-'} (${platform})\n` +
        `Pesan: "${note || '(kosong)'}"\n` +
        `Amount: ${amount ?? '-'}\n` +
        `Buka Payment Admin untuk cocokkan item & Accept/Deny.`,
        15844367
    );

    res.status(200).json({ ok: true });
};
