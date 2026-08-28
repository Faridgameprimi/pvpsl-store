const { readJsonBody } = require('../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (!webhook) {
        // Not configured — don't block the purchase flow, just skip quietly.
        res.status(200).json({ ok: true, skipped: true });
        return;
    }

    const body = await readJsonBody(req);
    const { serverName, itemName, qty, qtyLabel, totalRm, totalIdrK, nickname, platform } = body || {};

    try {
        const discordRes = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: '🛒 Pesanan Baru — FaridSmp Store',
                    color: 15216943,
                    fields: [
                        { name: 'Server', value: String(serverName || '-'), inline: true },
                        { name: 'Item', value: `${itemName || '-'} (${qty || 1}x ${qtyLabel || ''})`.trim(), inline: false },
                        { name: 'Total', value: `RM ${totalRm} / ${totalIdrK}k IDR`, inline: true },
                        { name: 'Nickname', value: String(nickname || '-'), inline: true },
                        { name: 'Platform', value: String(platform || '-'), inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }]
            })
        });
        res.status(200).json({ ok: discordRes.ok });
    } catch (err) {
        // Never block the purchase flow because Discord failed.
        res.status(200).json({ ok: false, error: err.message });
    }
};
