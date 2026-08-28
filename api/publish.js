const { requireAuth, readJsonBody } = require('../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const auth = requireAuth(req);
    if (!auth) {
        res.status(401).json({ error: 'Sesi tidak valid atau sudah habis. Login ulang.' });
        return;
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const path = process.env.GITHUB_DATA_PATH || 'data.json';
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
        res.status(500).json({ error: 'Server belum di-setup. Isi GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN di Vercel → Project Settings → Environment Variables.' });
        return;
    }

    const body = await readJsonBody(req);
    const { data } = body || {};
    if (!data) {
        res.status(400).json({ error: 'Data kosong.' });
        return;
    }

    try {
        const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'faridsmp-admin'
        };

        let sha;
        const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers });
        if (getRes.ok) {
            const getJson = await getRes.json();
            sha = getJson.sha;
        } else if (getRes.status !== 404) {
            const errJson = await getRes.json().catch(() => ({}));
            throw new Error(errJson.message || `Gagal ambil file (${getRes.status})`);
        }

        const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64');
        const putRes = await fetch(apiBase, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Update data.json via admin panel (${new Date().toISOString()})`,
                content,
                branch,
                ...(sha ? { sha } : {})
            })
        });

        if (!putRes.ok) {
            const errJson = await putRes.json().catch(() => ({}));
            throw new Error(errJson.message || `Gagal commit (${putRes.status})`);
        }

        res.status(200).json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Gagal publish.' });
    }
};
