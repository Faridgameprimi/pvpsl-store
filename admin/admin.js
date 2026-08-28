/* =========================================================
   FaridSmp Admin Dashboard
   ========================================================= */

const DRAFT_KEY = 'faridsmp_admin_draft';

/* ---------- Auth guard ---------- */
if (sessionStorage.getItem('faridsmp_admin_session') !== '1') {
    window.location.href = 'index.html';
}

document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('faridsmp_admin_session');
    window.location.href = 'index.html';
});

/* ---------- Draft data (localStorage-backed working copy) ---------- */
let draft = null;

async function loadDraft() {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
        try { draft = JSON.parse(saved); return draft; } catch (e) { /* fall through to fetch */ }
    }
    const res = await fetch('../data.json', { cache: 'no-store' });
    draft = await res.json();
    saveDraft();
    return draft;
}

function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function slugify(str) {
    return String(str).toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/* ---------- Render "current data" list ---------- */
function renderCurrentData() {
    const container = document.getElementById('current-data-list');
    if (!draft.servers.length) {
        container.innerHTML = `<p class="form-hint">Belum ada store. Tambah lewat form di atas.</p>`;
        return;
    }

    container.innerHTML = draft.servers.map(server => {
        const items = [
            ...(server.ranks || []).map(r => ({ ...r, kind: 'rank' })),
            ...(server.keys || []).map(k => ({ ...k, kind: 'key' }))
        ];
        const itemRows = items.map(it => `
            <div class="data-row" style="margin-left:18px;">
                <div class="data-info">
                    <strong>${escapeHtml(it.name)} <span style="color:var(--text-faint); font-weight:400;">(${it.kind})</span></strong>
                    <span>RM ${it.price.rm.toFixed(2)} / ${it.price.idrK}k IDR</span>
                </div>
                <div class="data-actions">
                    <button type="button" class="admin-btn danger sfx" onclick="deleteItem('${server.slug}','${it.kind}','${it.id}')">Hapus</button>
                </div>
            </div>
        `).join('');

        return `
            <div class="data-row">
                <div class="data-info">
                    <strong>${escapeHtml(server.name)}</strong>
                    <span>${escapeHtml(server.slug)} · ${escapeHtml(server.ip)}:${server.port} · ${items.length} item</span>
                </div>
                <div class="data-actions">
                    <button type="button" class="admin-btn danger sfx" onclick="deleteStore('${server.slug}')">Hapus Store</button>
                </div>
            </div>
            ${itemRows}
        `;
    }).join('');

    // Also refresh the "item store" dropdown options
    const sel = document.getElementById('item-store');
    const currentVal = sel.value;
    sel.innerHTML = draft.servers.map(s => `<option value="${escapeHtml(s.slug)}">${escapeHtml(s.name)}</option>`).join('');
    if (currentVal) sel.value = currentVal;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

window.deleteStore = function (slug) {
    if (!confirm('Hapus store ini beserta semua rank/key di dalamnya?')) return;
    draft.servers = draft.servers.filter(s => s.slug !== slug);
    saveDraft();
    renderCurrentData();
};

window.deleteItem = function (slug, kind, id) {
    const server = draft.servers.find(s => s.slug === slug);
    if (!server) return;
    const key = kind === 'rank' ? 'ranks' : 'keys';
    server[key] = (server[key] || []).filter(i => i.id !== id);
    saveDraft();
    renderCurrentData();
};

/* ---------- Add store ---------- */
document.getElementById('store-name').addEventListener('input', (e) => {
    const slugField = document.getElementById('store-slug');
    if (!slugField.dataset.touched) slugField.value = slugify(e.target.value);
});
document.getElementById('store-slug').addEventListener('input', (e) => { e.target.dataset.touched = '1'; });

document.getElementById('form-add-store').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('store-name').value.trim();
    let slug = document.getElementById('store-slug').value.trim() || slugify(name);
    slug = slugify(slug);

    if (draft.servers.some(s => s.slug === slug)) {
        alert('Slug ini sudah dipakai store lain. Ganti nama/slug-nya.');
        return;
    }

    draft.servers.push({
        slug,
        name,
        tag: document.getElementById('store-tag').value.trim(),
        tagline: document.getElementById('store-tagline').value.trim(),
        description: document.getElementById('store-desc').value.trim(),
        ip: document.getElementById('store-ip').value.trim(),
        port: parseInt(document.getElementById('store-port').value.trim(), 10) || 25565,
        ranks: [],
        keys: []
    });
    saveDraft();
    renderCurrentData();
    e.target.reset();
    document.getElementById('store-slug').dataset.touched = '';
    alert(`Store "${name}" ditambahkan ke draft. Lanjut tambah item, atau publish kalau sudah selesai.`);
});

/* ---------- Add item ---------- */
const itemTypeSelect = document.getElementById('item-type');
function syncItemFormFields() {
    const isRank = itemTypeSelect.value === 'rank';
    document.getElementById('item-features-row').style.display = isRank ? 'flex' : 'none';
    document.getElementById('item-image-row').style.display = isRank ? 'none' : 'flex';
    document.getElementById('item-billing-label').textContent = isRank ? 'Label Durasi (Rank)' : 'Label Durasi (abaikan untuk Key)';
}
itemTypeSelect.addEventListener('change', syncItemFormFields);

document.getElementById('form-add-item').addEventListener('submit', (e) => {
    e.preventDefault();
    const storeSlug = document.getElementById('item-store').value;
    const server = draft.servers.find(s => s.slug === storeSlug);
    if (!server) { alert('Pilih store dulu (tambah store kalau belum ada).'); return; }

    const type = itemTypeSelect.value;
    const name = document.getElementById('item-name').value.trim();
    const rm = parseFloat(document.getElementById('item-rm').value) || 0;
    const idrK = parseFloat(document.getElementById('item-idrk').value) || 0;
    const qtyLabel = document.getElementById('item-qty-label').value.trim();
    const qtyQuick = document.getElementById('item-qty-quick').value.trim();

    const id = slugify(name) + '-' + Math.random().toString(36).slice(2, 6);
    const qty = qtyLabel ? {
        enabled: true,
        label: qtyLabel,
        quickSelect: qtyQuick ? qtyQuick.split(',').map(n => parseInt(n.trim(), 10)).filter(Boolean) : [1, 5, 10]
    } : { enabled: false };

    if (type === 'rank') {
        const features = document.getElementById('item-features').value
            .split('\n').map(f => f.trim()).filter(Boolean);
        server.ranks = server.ranks || [];
        server.ranks.push({
            id, name,
            billing: document.getElementById('item-billing').value.trim() || 'Permanent',
            price: { rm, idrK },
            features,
            qty
        });
    } else {
        server.keys = server.keys || [];
        server.keys.push({
            id, name,
            price: { rm, idrK },
            image: document.getElementById('item-image').value.trim() || `assets/images/${storeSlug}/${slugify(name)}.png`,
            qty
        });
    }

    saveDraft();
    renderCurrentData();
    e.target.reset();
    syncItemFormFields();
    alert(`Item "${name}" ditambahkan ke store "${server.name}".`);
});

/* ---------- Network settings ---------- */
function fillNetworkForm() {
    document.getElementById('net-discord').value = draft.network.discord || '';
    document.getElementById('net-donate').value = draft.network.donateUrl || '';
    document.getElementById('net-whatsapp').value = draft.network.whatsapp || '';
    document.getElementById('net-webhook').value = draft.network.discordWebhook || '';
}
document.getElementById('btn-save-network').addEventListener('click', () => {
    draft.network.discord = document.getElementById('net-discord').value.trim();
    draft.network.donateUrl = document.getElementById('net-donate').value.trim();
    draft.network.whatsapp = document.getElementById('net-whatsapp').value.trim();
    draft.network.discordWebhook = document.getElementById('net-webhook').value.trim();
    saveDraft();
    alert('Pengaturan network disimpan ke draft.');
});

/* ---------- Publish: download ---------- */
document.getElementById('btn-download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'data.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

/* ---------- Publish: GitHub API ---------- */
function fillGithubForm() {
    document.getElementById('gh-owner').value = GITHUB_CONFIG.owner || '';
    document.getElementById('gh-repo').value = GITHUB_CONFIG.repo || '';
    document.getElementById('gh-branch').value = GITHUB_CONFIG.branch || 'main';
    document.getElementById('gh-path').value = GITHUB_CONFIG.path || 'data.json';
}

function setPublishStatus(msg, type) {
    const el = document.getElementById('publish-status');
    el.textContent = msg;
    el.className = 'publish-status' + (type ? ' ' + type : '');
}

document.getElementById('btn-publish-github').addEventListener('click', async () => {
    const owner = document.getElementById('gh-owner').value.trim();
    const repo = document.getElementById('gh-repo').value.trim();
    const branch = document.getElementById('gh-branch').value.trim() || 'main';
    const path = document.getElementById('gh-path').value.trim() || 'data.json';
    const token = document.getElementById('gh-token').value.trim();

    if (!owner || !repo || !token) {
        setPublishStatus('Isi GitHub owner, repo, dan token dulu.', 'err');
        return;
    }

    setPublishStatus('Menghubungi GitHub...', '');

    try {
        const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github+json'
        };

        // Get current file SHA (needed to update an existing file)
        let sha = undefined;
        const getRes = await fetch(`${apiBase}?ref=${branch}`, { headers });
        if (getRes.ok) {
            const getJson = await getRes.json();
            sha = getJson.sha;
        } else if (getRes.status !== 404) {
            const errJson = await getRes.json().catch(() => ({}));
            throw new Error(errJson.message || `GET gagal (${getRes.status})`);
        }

        const content = btoa(unescape(encodeURIComponent(JSON.stringify(draft, null, 2))));
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
            throw new Error(errJson.message || `PUT gagal (${putRes.status})`);
        }

        setPublishStatus('✅ Berhasil di-publish! GitHub Pages biasanya update dalam 1–2 menit.', 'ok');
    } catch (err) {
        setPublishStatus('❌ Gagal publish: ' + err.message, 'err');
    }
});

/* ---------- Reset draft ---------- */
document.getElementById('btn-reset-draft').addEventListener('click', async () => {
    if (!confirm('Buang semua perubahan draft dan muat ulang dari data.json yang live sekarang?')) return;
    localStorage.removeItem(DRAFT_KEY);
    await loadDraft();
    renderCurrentData();
    fillNetworkForm();
    setPublishStatus('Draft di-reset ke data.json live.', 'ok');
});

/* ---------- Boot ---------- */
(async function init() {
    await loadDraft();
    renderCurrentData();
    fillNetworkForm();
    fillGithubForm();
    syncItemFormFields();
})();
