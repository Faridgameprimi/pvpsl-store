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
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
        res.status(500).json({ error: 'Server belum di-setup. Isi GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN di Vercel → Project Settings → Environment Variables.' });
        return;
    }

    const body = await readJsonBody(req);
    const { storeSlug, filename, base64 } = body || {};

    if (!storeSlug || !filename || !base64) {
        res.status(400).json({ error: 'storeSlug, filename, dan base64 wajib diisi.' });
        return;
    }

    const safeSlug = String(storeSlug).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    let safeFilename = String(filename).toLowerCase().replace(/[^a-z0-9.-]/g, '-');
    if (!/\.(png|jpg|jpeg|webp)$/i.test(safeFilename)) safeFilename += '.png';

    const imgPath = `assets/images/${safeSlug}/${safeFilename}`;
    const cleanBase64 = String(base64).replace(/^data:image\/\w+;base64,/, '');

    // Rough size guard — GitHub Contents API caps at ~1MB per file via this endpoint.
    const approxBytes = (cleanBase64.length * 3) / 4;
    if (approxBytes > 1_000_000) {
        res.status(400).json({ error: 'Gambar terlalu besar (maks ~1MB). Kompres dulu.' });
        return;
    }

    try {
        const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${imgPath}`;
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
            throw new Error(errJson.message || `Gagal cek file (${getRes.status})`);
        }

        const putRes = await fetch(apiBase, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Upload gambar ${safeFilename} via admin panel`,
                content: cleanBase64,
                branch,
                ...(sha ? { sha } : {})
            })
        });

        if (!putRes.ok) {
            const errJson = await putRes.json().catch(() => ({}));
            throw new Error(errJson.message || `Gagal upload (${putRes.status})`);
        }

        res.status(200).json({ ok: true, path: imgPath });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Gagal upload gambar.' });
    }
};
