/* =========================================================
   FaridSmp Store — shared public-site script
   Loads data.json and renders the lobby / store pages,
   handles the purchase form + Discord webhook + Sociabuzz
   donate hand-off, click sounds, live player count, IP copy.
   ========================================================= */

const SCRIPT_BASE = (() => {
    const el = document.currentScript;
    if (!el) return '';
    return el.src.replace(/script\.js(\?.*)?$/, '');
})();

let SITE_DATA = null;

async function loadSiteData() {
    if (SITE_DATA) return SITE_DATA;
    const res = await fetch(SCRIPT_BASE + 'data.json', { cache: 'no-store' });
    SITE_DATA = await res.json();
    return SITE_DATA;
}

const fmtPrice = (rm, idrK) => `RM ${Number(rm).toFixed(2)} / ${idrK}k IDR`;
const escapeHtml = (str) => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ============================================================
   Purchase modal (injected once, shared by every public page)
   ============================================================ */
function injectPurchaseModal() {
    if (document.getElementById('purchase-modal')) return;
    const html = `
    <div class="modal-overlay" id="purchase-modal">
        <div class="modal-box glass" id="modal-box">
            <button class="modal-close" id="modal-close-btn" aria-label="Tutup">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div id="modal-step-form">
                <h3>Form Pembelian</h3>
                <p class="modal-sub">Isi nickname Minecraft kamu untuk lanjut ke pembayaran.</p>
                <div class="modal-order-summary" id="modal-order-summary"></div>
                <form id="purchase-form">
                    <div class="field">
                        <label for="mc-nickname">Nickname Minecraft</label>
                        <input type="text" id="mc-nickname" placeholder="Contoh: Steve123" required autocomplete="off">
                    </div>
                    <div class="field">
                        <label>Platform</label>
                        <div class="platform-toggle">
                            <label><input type="radio" name="mc-platform" value="Java" checked><span>Java</span></label>
                            <label><input type="radio" name="mc-platform" value="Bedrock"><span>Bedrock</span></label>
                        </div>
                    </div>
                    <button type="submit" class="btn-buy sfx">Lanjut ke Pembayaran</button>
                </form>
            </div>
            <div id="modal-step-success" class="modal-success" style="display:none;">
                <div class="success-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <h3>Pesanan Dicatat!</h3>
                <p id="modal-success-text"></p>
                <a href="#" id="modal-donate-btn" target="_blank" rel="noopener" class="btn-buy donate-btn sfx">Donate via Sociabuzz</a>
                <a href="#" id="modal-wa-btn" target="_blank" rel="noopener" class="btn-outline sfx" style="display:block; margin-top:12px;">Konfirmasi via WhatsApp</a>
                <p class="modal-note">Sertakan Nickname, Platform, dan Item di catatan donasi Sociabuzz supaya admin bisa verifikasi pesananmu.</p>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('modal-close-btn').addEventListener('click', closePurchaseModal);
    document.getElementById('purchase-modal').addEventListener('click', (e) => {
        if (e.target.id === 'purchase-modal') closePurchaseModal();
    });
    document.getElementById('purchase-form').addEventListener('submit', handlePurchaseSubmit);
}

let currentOrder = null;

function openPurchaseModal(order) {
    currentOrder = order; // { name, rm, idrK, qty, qtyLabel }
    injectPurchaseModal();

    document.getElementById('modal-step-form').style.display = 'block';
    document.getElementById('modal-step-success').style.display = 'none';
    document.getElementById('purchase-form').reset();

    const totalRm = (order.rm * order.qty).toFixed(2);
    const totalIdrK = (order.idrK * order.qty).toLocaleString('id-ID', { maximumFractionDigits: 1 });
    document.getElementById('modal-order-summary').innerHTML = `
        <div class="row"><span>Item</span><span>${escapeHtml(order.name)}</span></div>
        <div class="row"><span>${escapeHtml(order.qtyLabel || 'Jumlah')}</span><span>${order.qty}x</span></div>
        <div class="row total"><span>Total</span><span>RM ${totalRm} / ${totalIdrK}k IDR</span></div>
    `;

    document.getElementById('purchase-modal').classList.add('open');
}

function closePurchaseModal() {
    const el = document.getElementById('purchase-modal');
    if (el) el.classList.remove('open');
}

async function handlePurchaseSubmit(e) {
    e.preventDefault();
    if (!currentOrder) return;

    const nickname = document.getElementById('mc-nickname').value.trim();
    const platform = document.querySelector('input[name="mc-platform"]:checked').value;
    if (!nickname) return;

    const totalRm = (currentOrder.rm * currentOrder.qty).toFixed(2);
    const totalIdrK = (currentOrder.idrK * currentOrder.qty).toLocaleString('id-ID', { maximumFractionDigits: 1 });

    // Notify Discord via the serverless endpoint — the webhook URL itself
    // stays private on the server (Vercel env var), never exposed to the browser.
    try {
        fetch('/api/notify-discord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverName: window.__currentServerName || '',
                itemName: currentOrder.name,
                qty: currentOrder.qty,
                qtyLabel: currentOrder.qtyLabel || '',
                totalRm,
                totalIdrK,
                nickname,
                platform
            })
        }).catch(() => { /* ignore network errors — never block the purchase flow */ });
    } catch (e2) { /* ignore */ }

    const data = await loadSiteData();
    const donateUrl = (data.network && data.network.donateUrl) || 'https://sociabuzz.com/faridsmp/tribe';
    const waNumber = (data.network && data.network.whatsapp) || '';

    document.getElementById('modal-success-text').innerHTML =
        `<strong>${escapeHtml(currentOrder.name)}</strong> (${currentOrder.qty}x) — RM ${totalRm} / ${totalIdrK}k IDR<br>
         Nickname: <strong>${escapeHtml(nickname)}</strong> · Platform: <strong>${platform}</strong><br><br>
         Klik tombol di bawah untuk lanjut donasi ke FaridSmp lewat Sociabuzz.`;

    document.getElementById('modal-donate-btn').href = donateUrl;

    if (waNumber) {
        const waMsg = `Halo, saya baru saja order:\nItem: ${currentOrder.name} (${currentOrder.qty}x)\nTotal: RM ${totalRm} / ${totalIdrK}k IDR\nNickname: ${nickname}\nPlatform: ${platform}\n\nSaya akan donate lewat Sociabuzz.`;
        document.getElementById('modal-wa-btn').href = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
        document.getElementById('modal-wa-btn').style.display = 'block';
    } else {
        document.getElementById('modal-wa-btn').style.display = 'none';
    }

    document.getElementById('modal-step-form').style.display = 'none';
    document.getElementById('modal-step-success').style.display = 'block';
}

/* ============================================================
   Item card rendering (rank / key — same shape, optional qty)
   ============================================================ */
function renderItemCard(item, kind) {
    const price = fmtPrice(item.price.rm, item.price.idrK);
    const qty = item.qty && item.qty.enabled;
    const inputId = `qty-${item.id}`;
    const priceId = `price-${item.id}`;

    const imageBlock = kind === 'key' ? `
        <img class="key-img" src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.name)}"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="key-fallback" style="display:${item.image ? 'none' : 'flex'};">${escapeHtml(item.name).toUpperCase()}</div>
    ` : '';

    const badgeBlock = kind === 'rank' ? `<div class="rank-badge">RANK</div>` : '';

    const featuresBlock = item.features ? `
        <ul class="features">
            ${item.features.map(f => `<li>+ ${escapeHtml(f)}</li>`).join('')}
        </ul>` : '';

    const qtyBlock = qty ? `
        <div class="qty-container">
            <label for="${inputId}">${escapeHtml(item.qty.label || 'Jumlah')}:</label>
            <input type="number" id="${inputId}" min="1" value="1" oninput="window.updateItemPrice('${item.id}')">
        </div>
        <div class="quick-select">
            ${(item.qty.quickSelect || [1, 5, 10]).map(n => `<button type="button" class="sfx" onclick="window.setItemQty('${item.id}', ${n})">${n}x</button>`).join('')}
        </div>` : '';

    const subLabel = kind === 'rank' ? (item.billing || 'Permanent') : 'Per Item';

    return `
        <div class="card glass ${kind === 'rank' ? 'rank-card' : ''}" data-item-id="${item.id}">
            ${imageBlock}
            ${badgeBlock}
            <h3>${escapeHtml(item.name)}</h3>
            ${featuresBlock}
            ${qtyBlock}
            <p class="subscription">${escapeHtml(subLabel)}</p>
            <p class="price" id="${priceId}">${price}</p>
            <button type="button" class="btn-buy sfx" onclick="window.buyItem('${item.id}')">Buy Now</button>
        </div>`;
}

window.__itemRegistry = {};

function registerItems(items) {
    items.forEach(item => { window.__itemRegistry[item.id] = item; });
}

window.updateItemPrice = function (itemId) {
    const item = window.__itemRegistry[itemId];
    if (!item) return;
    const input = document.getElementById(`qty-${itemId}`);
    let qty = parseInt(input.value, 10);
    if (isNaN(qty) || qty < 1) qty = 1;
    input.value = qty;
    document.getElementById(`price-${itemId}`).textContent = fmtPrice(item.price.rm * qty, +(item.price.idrK * qty).toFixed(2));
};

window.setItemQty = function (itemId, qty) {
    const input = document.getElementById(`qty-${itemId}`);
    if (!input) return;
    input.value = qty;
    window.updateItemPrice(itemId);
};

window.buyItem = function (itemId) {
    const item = window.__itemRegistry[itemId];
    if (!item) return;
    const input = document.getElementById(`qty-${itemId}`);
    const qty = input ? (parseInt(input.value, 10) || 1) : 1;
    openPurchaseModal({
        name: item.name,
        rm: item.price.rm,
        idrK: item.price.idrK,
        qty,
        qtyLabel: item.qty ? item.qty.label : 'Jumlah'
    });
};

/* ============================================================
   Lobby page rendering
   ============================================================ */
async function renderLobby() {
    const container = document.getElementById('lobby-servers');
    if (!container) return;
    const data = await loadSiteData();

    container.innerHTML = data.servers.map(server => `
        <div class="server-card glass">
            <span class="hub-tag">${escapeHtml(server.tag || '')}</span>
            <h2>${escapeHtml(server.name)}</h2>
            <p class="server-desc">${escapeHtml(server.description || '')}</p>
            <div class="server-meta">
                <span class="player-badge" data-mc-address="${escapeHtml(server.ip)}:${server.port}">
                    <span class="status-dot"></span><span class="player-count">0</span> Players Online
                </span>
            </div>
            <div class="card-actions">
                <a href="store.html?server=${encodeURIComponent(server.slug)}" class="btn-buy sfx">Masuk Store →</a>
            </div>
        </div>
    `).join('');

    refreshPlayerCounts();
}

/* ============================================================
   Store page rendering
   ============================================================ */
async function renderStore() {
    const root = document.getElementById('store-app');
    if (!root) return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('server');
    const data = await loadSiteData();
    const server = data.servers.find(s => s.slug === slug) || data.servers[0];

    if (!server) {
        root.innerHTML = `<p style="text-align:center; padding:80px 20px; color:var(--text-dim);">Server tidak ditemukan.</p>`;
        return;
    }

    document.title = `${server.name} | FaridSmp Store`;
    document.querySelectorAll('.server-badge').forEach(el => el.textContent = server.name.toUpperCase());
    document.querySelectorAll('.js-server-name').forEach(el => el.textContent = server.name);
    document.querySelectorAll('.js-server-tagline').forEach(el => el.textContent = server.tagline || '');
    document.querySelectorAll('.js-server-desc').forEach(el => el.textContent = server.description || '');
    document.querySelectorAll('.player-badge').forEach(el => el.setAttribute('data-mc-address', `${server.ip}:${server.port}`));
    document.querySelectorAll('.js-ip-text').forEach(el => el.innerHTML = `${escapeHtml(server.ip)}<span class="port">:${server.port}</span>`);
    document.querySelectorAll('.js-copy-btn').forEach(el => el.setAttribute('data-copy', `${server.ip}:${server.port}`));
    document.querySelectorAll('a.nav-home, a.nav-home-footer').forEach(el => el.href = `store.html?server=${encodeURIComponent(server.slug)}`);
    document.querySelectorAll('a.nav-ranks').forEach(el => { el.href = `store.html?server=${encodeURIComponent(server.slug)}#ranks`; });
    document.querySelectorAll('a.nav-keys').forEach(el => { el.href = `store.html?server=${encodeURIComponent(server.slug)}#keys`; });

    registerItems(server.ranks || []);
    registerItems(server.keys || []);
    window.__currentServerName = server.name;

    const ranksPanel = document.getElementById('panel-ranks');
    const keysPanel = document.getElementById('panel-keys');
    if (ranksPanel) {
        const wrapClass = (server.ranks || []).length <= 1 ? 'single-card-wrap' : 'rank-container';
        ranksPanel.innerHTML = `<div class="${wrapClass}">${(server.ranks || []).map(r => renderItemCard(r, 'rank')).join('')}</div>`;
    }
    if (keysPanel) {
        keysPanel.innerHTML = `<div class="grid">${(server.keys || []).map(k => renderItemCard(k, 'key')).join('')}</div>`;
    }

    // Restore quick-select "quick select" price displays with correct qty=1 defaults already baked in.
    refreshPlayerCounts();
    setupTabs();
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    if (!tabs.length) return;
    const activate = (name) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
    };
    tabs.forEach(btn => btn.addEventListener('click', () => {
        activate(btn.dataset.tab);
        history.replaceState(null, '', `#${btn.dataset.tab}`);
    }));
    const hash = window.location.hash.replace('#', '');
    activate(hash === 'keys' ? 'keys' : 'ranks');
}

/* ============================================================
   Live player count (works for any number of distinct servers)
   ============================================================ */
function animateCount(el, to) {
    const from = parseInt(el.dataset.current || '0', 10);
    const duration = 900;
    const startTime = performance.now();
    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(from + (to - from) * eased);
        el.textContent = value.toLocaleString('id-ID');
        if (progress < 1) requestAnimationFrame(step);
        else el.dataset.current = String(to);
    }
    requestAnimationFrame(step);
}

async function refreshPlayerCounts() {
    const badges = document.querySelectorAll('[data-mc-address]');
    if (!badges.length) return;
    const addresses = [...new Set([...badges].map(el => el.dataset.mcAddress))];
    const results = {};

    await Promise.all(addresses.map(async (addr) => {
        try {
            const res = await fetch(`https://api.mcsrvstat.us/3/${addr}`, { cache: 'no-store' });
            const json = await res.json();
            const online = !!json.online;
            results[addr] = { online, count: online && json.players ? (json.players.online || 0) : 0 };
        } catch (e) {
            results[addr] = null;
        }
    }));

    badges.forEach(el => {
        const r = results[el.dataset.mcAddress];
        const countEl = el.querySelector('.player-count');
        const dotEl = el.querySelector('.status-dot');
        if (!r) {
            if (countEl && !countEl.dataset.current) countEl.textContent = '—';
            return;
        }
        if (dotEl) dotEl.classList.toggle('offline', !r.online);
        el.classList.toggle('is-offline', !r.online);
        if (countEl) animateCount(countEl, r.count);
    });
}

/* ============================================================
   Boot
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

    /* ---------- Click sound ---------- */
    const clickSound = new Audio(SCRIPT_BASE + 'assets/sounds/click.mp3');
    clickSound.volume = 0.45;
    clickSound.preload = 'auto';
    function playClickSound() {
        try {
            clickSound.currentTime = 0;
            const p = clickSound.play();
            if (p !== undefined) p.catch(() => {});
        } catch (e) { /* ignore */ }
    }
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.sfx')) playClickSound();
    });

    /* ---------- Copy server IP:port (event delegation — works for dynamic content) ---------- */
    document.body.addEventListener('click', async (e) => {
        const btn = e.target.closest('.copy-btn[data-copy]');
        if (!btn) return;
        const text = btn.dataset.copy;
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
            document.body.removeChild(ta);
        }
        const original = btn.innerHTML;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.innerHTML = original; btn.classList.remove('copied'); }, 1500);
    });

    injectPurchaseModal();
    renderLobby();
    renderStore();

    setInterval(refreshPlayerCounts, 60000);
});
