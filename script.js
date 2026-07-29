/* =========================================================
   FaridSmp Store — shared script
   Handles: button click sounds, key price calculator,
   quick-select quantity buttons.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

    /* ---------- Click sound ---------- */
    // Drop your sound file at assets/sounds/click.mp3 (see README in that folder).
    // If the file isn't there yet, play() simply fails silently — nothing breaks.
    const clickSound = new Audio('assets/sounds/click.mp3');
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

    /* ---------- Key price calculator ---------- */
    const keyData = {
        iron:      { name: 'Iron Key',      rm: 3.50,  idr: 13 },
        gold:      { name: 'Gold Key',      rm: 6.50,  idr: 25 },
        diamond:   { name: 'Diamond Key',   rm: 12.50, idr: 48 },
        netherite: { name: 'Netherite Key', rm: 18.50, idr: 71 }
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

});
