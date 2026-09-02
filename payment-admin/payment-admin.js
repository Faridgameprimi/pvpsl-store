/* =========================================================
   FaridSmp Payment Admin Dashboard
   ========================================================= */

const TOKEN_KEY = 'faridsmp_payment_token';
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

let catalog = null; // data.json contents
let itemIndex = {}; // itemId -> { name, storeSlug, storeName, price }

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadCatalog() {
    const res = await fetch('../data.json', { cache: 'no-store' });
    catalog = await res.json();
    itemIndex = {};
    (catalog.servers || []).forEach(server => {
        [...(server.ranks || []), ...(server.keys || [])].forEach(item => {
            itemIndex[item.id] = { name: item.name, storeSlug: server.slug, storeName: server.name, price: item.price };
        });
    });
}

function itemLabel(itemId) {
    const it = itemIndex[itemId];
    return it ? `${it.name} (${it.storeName})` : (itemId || '(item tidak diketahui)');
}

/* ---------- Manual grant form: populate stores/items ---------- */
function fillManualGrantSelectors() {
    const storeSel = document.getElementById('mg-store');
    storeSel.innerHTML = (catalog.servers || []).map(s => `<option value="${escapeHtml(s.slug)}">${escapeHtml(s.name)}</option>`).join('');
    updateManualGrantItems();
}
function updateManualGrantItems() {
    const storeSlug = document.getElementById('mg-store').value;
    const server = (catalog.servers || []).find(s => s.slug === storeSlug);
    const itemSel = document.getElementById('mg-item');
    if (!server) { itemSel.innerHTML = ''; return; }
    const items = [...(server.ranks || []).map(r => ({ ...r, kind: 'Rank' })), ...(server.keys || []).map(k => ({ ...k, kind: 'Key' }))];
    itemSel.innerHTML = items.map(it => `<option value="${escapeHtml(it.id)}">${escapeHtml(it.name)} (${it.kind}) — RM ${it.price.rm.toFixed(2)}</option>`).join('');
}
document.getElementById('mg-store').addEventListener('change', updateManualGrantItems);

document.getElementById('form-manual-grant').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('manual-grant-status');
    statusEl.textContent = 'Mengirim...';
    statusEl.className = 'publish-status';

    const payload = {
        itemId: document.getElementById('mg-item').value,
        nickname: document.getElementById('mg-nickname').value.trim(),
        platform: document.getElementById('mg-platform').value,
        qty: parseInt(document.getElementById('mg-qty').value, 10) || 1
    };

    try {
        const res = await fetch('/api/manual-grant', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
        const json = await res.json();
        if (res.ok && json.ok) {
            statusEl.textContent = '✅ Terkirim ke antrian plugin.';
            statusEl.className = 'publish-status ok';
            e.target.reset();
            fillManualGrantSelectors();
        } else {
            throw new Error(json.error || 'Gagal kirim');
        }
    } catch (err) {
        statusEl.textContent = '❌ ' + err.message;
        statusEl.className = 'publish-status err';
    }
});

/* ---------- Review queue ---------- */
let allReviews = [];

async function loadReviews() {
    const res = await fetch('/api/review-orders', { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal ambil data');
    allReviews = json.reviews || [];
}

function renderStats() {
    document.getElementById('stat-pending').textContent = allReviews.filter(r => r.status === 'pending').length;
    document.getElementById('stat-accepted').textContent = allReviews.filter(r => r.status === 'accepted').length;
    document.getElementById('stat-denied').textContent = allReviews.filter(r => r.status === 'denied').length;
}

function buildCorrectionSelect(review) {
    const options = Object.entries(itemIndex).map(([id, it]) =>
        `<option value="${escapeHtml(id)}">${escapeHtml(it.name)} (${escapeHtml(it.storeName)})</option>`
    ).join('');
    return `<select class="correction-item"><option value="">— pilih item —</option>${options}</select>`;
}

function renderPending() {
    const container = document.getElementById('pending-list');
    const pending = allReviews.filter(r => r.status === 'pending');

    if (!pending.length) {
        container.innerHTML = `<p class="form-hint">Tidak ada order menunggu.</p>`;
        return;
    }

    container.innerHTML = pending.map(r => {
        const time = r.receivedAt ? new Date(r.receivedAt).toLocaleString('id-ID') : '-';
        return `
        <div class="review-card glass needs-correction" data-id="${escapeHtml(r.id)}">
            <div class="review-main">
                <strong>Nama Sociabuzz: "${escapeHtml(r.supporterName || '-')}"</strong>
                <span class="review-meta">Pesan: "${escapeHtml(r.rawNote || '(kosong)')}"</span>
                <span class="review-meta">Amount: ${r.amount ?? '-'} · ${time}</span>
                <div class="correction-row">
                    <label>Item</label>
                    ${buildCorrectionSelect(r)}
                </div>
                <div class="correction-row">
                    <label>Nickname</label>
                    <input type="text" class="correction-nick" value="${escapeHtml(r.nickname || '')}" placeholder="Nickname Minecraft">
                </div>
                <div class="correction-row">
                    <label>Platform</label>
                    <select class="correction-platform">
                        <option value="Java" ${r.platform === 'Java' ? 'selected' : ''}>Java</option>
                        <option value="Bedrock" ${r.platform === 'Bedrock' ? 'selected' : ''}>Bedrock</option>
                    </select>
                </div>
                <div class="correction-row">
                    <label>Jumlah</label>
                    <input type="number" class="correction-qty" value="${r.qty || 1}" min="1">
                </div>
            </div>
            <div class="review-actions">
                <button type="button" class="admin-btn sfx" onclick="acceptReview('${r.id}')">✅ Accept</button>
                <button type="button" class="admin-btn danger sfx" onclick="denyReview('${r.id}')">❌ Deny</button>
            </div>
        </div>`;
    }).join('');
}

function renderHistory() {
    const container = document.getElementById('history-list');
    const history = allReviews.filter(r => r.status !== 'pending').slice(0, 20);
    if (!history.length) {
        container.innerHTML = `<p class="form-hint">Belum ada riwayat.</p>`;
        return;
    }
    container.innerHTML = history.map(r => `
        <div class="data-row">
            <div class="data-info">
                <strong>${escapeHtml(itemLabel(r.finalItemId || r.itemId))} ${r.status === 'accepted' ? '✅' : '❌'}</strong>
                <span>${escapeHtml(r.finalNickname || r.nickname || '-')} · ${r.status} · ${r.acceptedAt || r.deniedAt ? new Date(r.acceptedAt || r.deniedAt).toLocaleString('id-ID') : ''}</span>
            </div>
        </div>
    `).join('');
}

window.acceptReview = async function (id) {
    const card = document.querySelector(`.review-card[data-id="${id}"]`);
    if (!card) return;

    const overrides = {
        itemId: card.querySelector('.correction-item').value,
        nickname: card.querySelector('.correction-nick').value.trim(),
        platform: card.querySelector('.correction-platform').value,
        qty: parseInt(card.querySelector('.correction-qty').value, 10) || 1
    };

    if (!overrides.itemId) { alert('Pilih item dulu.'); return; }
    if (!overrides.nickname) { alert('Isi nickname dulu.'); return; }

    await submitReviewAction(id, 'accept', overrides);
};

window.denyReview = async function (id) {
    if (!confirm('Tolak order ini?')) return;
    await submitReviewAction(id, 'deny');
};

async function submitReviewAction(id, action, overrides) {
    try {
        const res = await fetch('/api/review-action', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ id, action, overrides })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal proses');
        await refreshAll();
    } catch (err) {
        alert('Gagal: ' + err.message);
    }
}

async function refreshAll() {
    await loadReviews();
    renderStats();
    renderPending();
    renderHistory();
}

document.getElementById('refresh-btn').addEventListener('click', refreshAll);

/* ---------- Boot ---------- */
(async function init() {
    await loadCatalog();
    fillManualGrantSelectors();
    await refreshAll();
})();
