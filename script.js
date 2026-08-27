/* =========================================================
   FaridSmp Store — shared script
   Handles: button click sounds, key price calculator,
   quick-select quantity buttons, live player count, IP copy.
   ========================================================= */

// Resolve this script's own folder so asset paths (assets/sounds/...)
// work the same whether the page loads it as "script.js" (root)
// or "../script.js" (from broken-anarchy/rank.html, key.html, etc).
// Must run at top level — document.currentScript is only valid
// during synchronous, initial script execution.
const SCRIPT_BASE = (() => {
    const el = document.currentScript;
    if (!el) return '';
    return el.src.replace(/script\.js(\?.*)?$/, '');
})();

document.addEventListener('DOMContentLoaded', () => {

    /* ---------- Click sound ---------- */
    // Drop your sound file at assets/sounds/click.mp3 (see README in that folder).
    // If the file isn't there yet, play() simply fails silently — nothing breaks.
    const clickSound = new Audio(SCRIPT_BASE + 'assets/sounds/click.mp3');
    clickSound.volume = 0.45;
    clickSound.preload = 'auto';

    function playClickSound() {
        try {
            clickSound.currentTime = 0;
            const p = clickSound.play();
            if (p !== undefined) p.catch(() => { /* file missing or autoplay blocked — ignore */ });
        } catch (e) { /* ignore */ }
    }

    // Delegate so it also covers buttons added dynamically.
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('.sfx');
        if (target) playClickSound();
    });

    /* ---------- Live player count ---------- */
    const SERVER_ADDRESS = 'faridsmp.xyz:19291';
    const STATUS_API = `https://api.mcsrvstat.us/3/${SERVER_ADDRESS}`;

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

    async function refreshPlayerCount() {
        const targets = document.querySelectorAll('.player-count');
        if (!targets.length) return;

        try {
            const res = await fetch(STATUS_API, { cache: 'no-store' });
            const data = await res.json();
            const online = !!(data && data.online);
            const count = online && data.players ? (data.players.online || 0) : 0;

            targets.forEach(el => {
                const badge = el.closest('.player-badge');
                if (badge) badge.classList.toggle('is-offline', !online);
                animateCount(el, count);
            });
            document.querySelectorAll('.player-status-label').forEach(el => {
                el.textContent = online ? 'Server Online' : 'Server Offline';
            });
            document.querySelectorAll('.status-dot').forEach(el => {
                el.classList.toggle('offline', !online);
            });
        } catch (e) {
            // Network blocked or API unreachable — fail quietly, keep last known value.
            targets.forEach(el => {
                if (!el.dataset.current) el.textContent = '—';
            });
        }
    }

    refreshPlayerCount();
    setInterval(refreshPlayerCount, 60000);

    /* ---------- Copy server IP:port ---------- */
    document.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
        const originalLabel = btn.innerHTML;
        btn.addEventListener('click', async () => {
            const text = btn.dataset.copy;
            try {
                await navigator.clipboard.writeText(text);
            } catch (e) {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (err) { /* ignore */ }
                document.body.removeChild(ta);
            }
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.innerHTML = originalLabel;
                btn.classList.remove('copied');
            }, 1500);
        });
    });

    /* ---------- Key price calculator ---------- */
    const keyData = {
        amethyst: { name: 'Amethyst Key', rm: 3.50, idr: 15 },
        farid:    { name: 'Farid Key',    rm: 3.50, idr: 15 }
    };

    const phoneNumber = '60142446184';

    window.calculateKeyPrice = function (type) {
        const input = document.getElementById(type + '-qty');
        if (!input) return;
        let qty = parseInt(input.value, 10);
        if (isNaN(qty) || qty < 1) qty = 1;
        input.value = qty;

        const data = keyData[type];
        const totalRM = (data.rm * qty).toFixed(2);
        const totalIDR = data.idr * qty;

        const priceEl = document.getElementById(type + '-price');
        if (priceEl) priceEl.innerText = `RM ${totalRM} / ${totalIDR}k IDR`;

        const message = `Halo, saya mau beli ${data.name} (RM ${totalRM} / ${totalIDR}k IDR).\nJumlah: ${qty}x\nNickname:`;
        const btn = document.getElementById(type + '-btn');
        if (btn) btn.href = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    };

    /* ---------- Quick-select quantity buttons ---------- */
    document.querySelectorAll('.quick-select button[data-key]').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.key;
            const amount = parseInt(btn.dataset.amount, 10);
            const input = document.getElementById(type + '-qty');
            if (!input) return;
            input.value = amount;
            calculateKeyPrice(type);
        });
    });

    /* ---------- Rank price calculator (Weekly Plus Pass, per week) ---------- */
    const RANK_RM_PER_WEEK = 1.50;
    const RANK_IDR_PER_WEEK = 6.5; // in "k" units, i.e. Rp 6.500

    window.calculateRankPrice = function () {
        const input = document.getElementById('rank-qty');
        if (!input) return;
        let weeks = parseInt(input.value, 10);
        if (isNaN(weeks) || weeks < 1) weeks = 1;
        input.value = weeks;

        const totalRM = (RANK_RM_PER_WEEK * weeks).toFixed(2);
        const totalIDR = (RANK_IDR_PER_WEEK * weeks).toLocaleString('id-ID', { maximumFractionDigits: 1 });

        const priceEl = document.getElementById('rank-price');
        if (priceEl) priceEl.innerText = `RM ${totalRM} / ${totalIDR}k IDR`;

        const message = `Halo, saya mau beli Rank Weekly Plus Pass (RM ${totalRM} / ${totalIDR}k IDR).\nJumlah: ${weeks} minggu\nNickname:`;
        const btn = document.getElementById('rank-btn');
        if (btn) btn.href = `https://wa.me/60142446184?text=${encodeURIComponent(message)}`;
    };

    document.querySelectorAll('.quick-select button[data-weeks]').forEach(btn => {
        btn.addEventListener('click', () => {
            const weeks = parseInt(btn.dataset.weeks, 10);
            const input = document.getElementById('rank-qty');
            if (!input) return;
            input.value = weeks;
            calculateRankPrice();
        });
    });

});
