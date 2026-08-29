/* Shared helper for reading/writing files in the GitHub repo via the
   Contents API. Used as the persistent "database" for pending orders
   since Vercel functions themselves are stateless. */

function envOrThrow() {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !repo || !token) {
        throw new Error('Server belum di-setup: GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN env var belum diisi.');
    }
    return { owner, repo, branch, token };
}

function headers(token) {
    return {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'faridsmp-admin'
    };
}

/** Reads a JSON file from the repo. Returns { data, sha } or { data: fallback, sha: null } if the file doesn't exist yet. */
async function readJsonFile(path, fallback) {
    const { owner, repo, branch, token } = envOrThrow();
    const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const res = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers: headers(token) });

    if (res.status === 404) return { data: fallback, sha: null };
    if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `Gagal baca ${path} (${res.status})`);
    }

    const json = await res.json();
    const content = Buffer.from(json.content, 'base64').toString('utf8');
    try {
        return { data: JSON.parse(content), sha: json.sha };
    } catch (e) {
        return { data: fallback, sha: json.sha };
    }
}

/** Writes a JSON file to the repo (create or update). */
async function writeJsonFile(path, data, message, knownSha) {
    const { owner, repo, branch, token } = envOrThrow();
    const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    let sha = knownSha;
    if (sha === undefined) {
        const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers: headers(token) });
        if (getRes.ok) {
            const j = await getRes.json();
            sha = j.sha;
        } else if (getRes.status !== 404) {
            const j = await getRes.json().catch(() => ({}));
            throw new Error(j.message || `Gagal cek ${path} (${getRes.status})`);
        }
    }

    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64');
    const putRes = await fetch(apiBase, {
        method: 'PUT',
        headers: { ...headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, content, branch, ...(sha ? { sha } : {}) })
    });

    if (!putRes.ok) {
        const j = await putRes.json().catch(() => ({}));
        throw new Error(j.message || `Gagal simpan ${path} (${putRes.status})`);
    }

    return true;
}

module.exports = { readJsonFile, writeJsonFile };
