/* =========================================================
   FaridSmp Admin Dashboard
   ========================================================= */

const DRAFT_KEY = 'faridsmp_admin_draft';
const TOKEN_KEY = 'faridsmp_admin_token';

/* ---------- Auth guard ---------- */
const authToken = sessionStorage.getItem(TOKEN_KEY);
if (!authToken) {
    window.location.href = 'index.html';
}

function authHeaders() {
    return { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };
}

document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.href = 'index.html';
});

/* ---------- Draft data (localStorage-backed working copy) ---------- */
let draft = null;
let pendingImageFile = null; // { dataUrl, filename }
let isDirty = false;

async function loadDraft() {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
        try { draft = JSON.parse(saved); return draft; } catch (e) { /* fall through */ }
    }
    const res = await fetch('../data.json', { cache: 'no-store' });
    draft = await res.json();
    saveDraft();
    return draft;
}

function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    markDirty();
}

function markDirty() {
    isDirty = true;
    localStorage.setItem(DRAFT_KEY + '_dirty', '1');
    updateStats();
}

function markClean() {
    isDirty = false;
    localStorage.removeItem(DRAFT_KEY + '_dirty');
    updateStats();
}

function slugify(str) {
    return String(str).toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Stats bar ---------- */
function updateStats() {
    const servers = draft.servers || [];
    const ranks = servers.reduce((n, s) => n + (s.ranks || []).length, 0);
    const keys = servers.reduce((n, s) => n + (s.keys || []).length, 0);
    document.getElementById('stat-servers').textContent = servers.length;
    document.getElementById('stat-ranks').textContent = ranks;
    document.getElementById('stat-keys').textContent = keys;

    const chip = document.getElementById('stat-draft-chip');
    const label = document.getElementById('stat-draft-label');
    if (isDirty) {
        chip.classList.remove('published');
        label.textContent = 'Draft belum di-publish';
    } else {
        chip.classList.add('published');
        label.textContent = 'Sudah di-publish';
    }
}

/* ---------- Render "current data" list ---------- */
function renderCurrentData() {
    const container = document.getElementById('current-data-list');
    if (!draft.servers.length) {
        container.innerHTML = `<p class="form-hint">Belum ada store. Tambah lewat form di atas.</p>`;
    } else {
        container.innerHTML = draft.servers.map(server => {
            const items = [
                ...(server.ranks || []).map(r => ({ ...r, kind: 'rank' })),
                ...(server.keys || []).map(k => ({ ...k, kind: 'key' }))
            ];
            const itemRows = items.map(it => `
                <div class="data-row" style="margin-left:18px;">
                    <div class="data-info">
                        <strong>${escapeHtml(it.name)} <span style="color:var(--text-faint); font-weight:400;">(${it.kind})</span></strong>
                        <span>RM ${it.price.rm.toFixed(2)} / ${it.price.idrK}k IDR${it.image ? ' · 🖼️ ada gambar' : ''}</span>
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
    }

    const sel = document.getElementById('item-store');
    const currentVal = sel.value;
    sel.innerHTML = draft.servers.map(s => `<option value="${escapeHtml(s.slug)}">${escapeHtml(s.name)}</option>`).join('');
    if (currentVal) sel.value = currentVal;

    updateStats();
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

/* ---------- Image picker preview ---------- */
const imageFileInput = document.getElementById('item-image-file');
const uploadPreview = document.getElementById('upload-preview');
const uploadPlaceholder = document.getElementById('upload-placeholder');

imageFileInput.addEventListener('change', () => {
    const file = imageFileInput.files[0];
    if (!file) { pendingImageFile = null; return; }
    if (file.size > 1_000_000) {
        alert('Gambar terlalu besar (maks ~1MB). Pilih gambar yang lebih kecil.');
        imageFileInput.value = '';
        pendingImageFile = null;
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        pendingImageFile = { dataUrl: reader.result, filename: file.name };
        uploadPreview.src = reader.result;
        uploadPreview.style.display = 'block';
        uploadPlaceholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
});

document.getElementById('form-add-item').addEventListener('submit', async (e) => {
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

    const addBtn = document.getElementById('add-item-btn');

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
        let imagePath = '';

        if (pendingImageFile) {
            addBtn.disabled = true;
            addBtn.textContent = 'Upload gambar...';
            try {
                const res = await fetch('/api/upload-image', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({
                        storeSlug,
                        filename: `${id}-${pendingImageFile.filename}`,
                        base64: pendingImageFile.dataUrl
                    })
                });
                const json = await res.json();
                if (res.ok && json.path) {
                    imagePath = json.path;
                } else {
                    alert('Gagal upload gambar: ' + (json.error || 'unknown error') + '\n\nItem tetap ditambahkan tanpa gambar (bisa upload manual nanti).');
                }
            } catch (err) {
                alert('Gagal upload gambar: ' + err.message + '\n\nItem tetap ditambahkan tanpa gambar.');
            } finally {
                addBtn.disabled = false;
                addBtn.textContent = '+ Tambah Item';
            }
        }

        server.keys = server.keys || [];
        server.keys.push({
            id, name,
            price: { rm, idrK },
            image: imagePath,
            qty
        });
    }

    saveDraft();
    renderCurrentData();
    e.target.reset();
    pendingImageFile = null;
    uploadPreview.style.display = 'none';
    uploadPlaceholder.style.display = 'flex';
    syncItemFormFields();
});

/* ---------- Network settings ---------- */
function fillNetworkForm() {
    document.getElementById('net-discord').value = draft.network.discord || '';
    document.getElementById('net-donate').value = draft.network.donateUrl || '';
    document.getElementById('net-whatsapp').value = draft.network.whatsapp || '';
}
document.getElementById('btn-save-network').addEventListener('click', () => {
    draft.network.discord = document.getElementById('net-discord').value.trim();
    draft.network.donateUrl = document.getElementById('net-donate').value.trim();
    draft.network.whatsapp = document.getElementById('net-whatsapp').value.trim();
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

/* ---------- Publish: via serverless function (no token needed in browser) ---------- */
function setPublishStatus(msg, type) {
    const el = document.getElementById('publish-status');
    el.textContent = msg;
    el.className = 'publish-status' + (type ? ' ' + type : '');
}

document.getElementById('btn-publish').addEventListener('click', async () => {
    const btn = document.getElementById('btn-publish');
    btn.disabled = true;
    btn.textContent = 'Publishing...';
    setPublishStatus('Menghubungi server...', '');

    try {
        const res = await fetch('/api/publish', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ data: draft })
        });
        const json = await res.json();
        if (res.ok && json.ok) {
            markClean();
            setPublishStatus('✅ Berhasil di-publish! Website update dalam 1–2 menit.', 'ok');
        } else {
            throw new Error(json.error || `Gagal (${res.status})`);
        }
    } catch (err) {
        setPublishStatus('❌ Gagal publish: ' + err.message, 'err');
    } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Publish ke GitHub';
    }
});

/* ---------- Reset draft ---------- */
document.getElementById('btn-reset-draft').addEventListener('click', async () => {
    if (!confirm('Buang semua perubahan draft dan muat ulang dari data.json yang live sekarang?')) return;
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY + '_dirty');
    await loadDraft();
    markClean();
    renderCurrentData();
    fillNetworkForm();
    setPublishStatus('Draft di-reset ke data.json live.', 'ok');
});

/* ---------- Boot ---------- */
(async function init() {
    await loadDraft();
    isDirty = localStorage.getItem(DRAFT_KEY + '_dirty') === '1';
    renderCurrentData();
    fillNetworkForm();
    syncItemFormFields();
})();
