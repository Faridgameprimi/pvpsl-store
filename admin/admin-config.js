/* =========================================================
   ADMIN CONFIG — ganti username & password kamu di sini.

   ⚠️ PENTING — baca ini:
   Website ini 100% statis (GitHub Pages, tanpa server/database).
   Username & password di bawah tersimpan sebagai teks BIASA di
   dalam file ini, dan SIAPA SAJA yang buka "View Page Source" atau
   DevTools browser di halaman admin bisa baca isinya.

   Panel login ini hanya untuk mencegah pengunjung biasa iseng
   buka menu admin — BUKAN sistem keamanan yang sungguhan aman.
   Jangan pernah pakai password yang sama dengan akun penting lain
   (email, bank, dll), dan jangan taruh data sensitif di sini.
   ========================================================= */

const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "gantipassword123"
};

/* =========================================================
   Konfigurasi GitHub — dipakai untuk fitur "Publish to GitHub"
   (opsional) di dashboard, supaya perubahan yang kamu buat di
   panel admin langsung ke-update ke repo GitHub Pages kamu.

   owner  = username GitHub kamu
   repo   = nama repository tempat website ini di-host
   branch = branch yang dipakai GitHub Pages (biasanya "main")
   path   = lokasi file data.json di dalam repo
   ========================================================= */

const GITHUB_CONFIG = {
    owner: "Faridgameprimi",
    repo: "https://github.com/Faridgameprimi/pvpsl-store",
    branch: "main",
    path: "data.json"
};
