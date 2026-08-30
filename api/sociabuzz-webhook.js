const { readJsonFile, writeJsonFile } = require('../lib/github');
const { readJsonBody } = require('../lib/auth');

const REVIEW_PATH = process.env.REVIEW_DATA_PATH || 'payment-review.json';

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
   [FARIDSMP-ORDER] item=weekly-plus-pass;qty=1;nick=Steve123;platform=Java
   Parsing it just PRE-FILLS the review card for admin convenience —
   it never skips the manual Accept/Deny step. */
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

    // Every order lands here as "pending" — nothing gets delivered until
    // a human clicks Accept in the Payment Admin panel.
    const review = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        source: 'sociabuzz',
        receivedAt: new Date().toISOString(),
        status: 'pending', // pending | accepted | denied
        amount,
        supporterName,
        rawNote: note,
        itemId: parsed ? parsed.itemId : null,
        qty: parsed ? parsed.qty : 1,
        nickname: parsed ? parsed.nickname : supporterName,
        platform: parsed ? parsed.platform : null,
        tagDetected: !!parsed
    };

    try {
        const { data, sha } = await readJsonFile(REVIEW_PATH, []);
        const reviews = Array.isArray(data) ? data : [];
        reviews.push(review);
        await writeJsonFile(REVIEW_PATH, reviews, `Order baru dari Sociabuzz (${review.nickname || 'unknown'})`, sha);
    } catch (err) {
        await notifyDiscord(`⚠️ Order masuk dari Sociabuzz tapi GAGAL disimpan: ${err.message}\nCatatan: ${note || '(kosong)'}`, 15548997);
        res.status(500).json({ error: err.message });
        return;
    }

    await notifyDiscord(
        `💰 **Order baru dari Sociabuzz — menunggu verifikasi admin**\n` +
        `${review.tagDetected ? `Item: \`${review.itemId}\` x${review.qty}\nNickname: **${review.nickname}** (${review.platform})` : `⚠️ Kode order tidak ke-detect — cek manual\nCatatan: ${note || '(kosong)'}`}\n` +
        `Amount: ${amount ?? '-'} · Supporter: ${supporterName || '-'}\n` +
        `Buka Payment Admin untuk Accept/Deny.`,
        15844367
    );

    res.status(200).json({ ok: true });
};
