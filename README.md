# FaridSmp Store

Website statis (HTML/CSS/JS murni) — bisa langsung di-host pakai **GitHub Pages**, tanpa hosting lain, tanpa backend.

## Struktur

```
index.html          ← Lobby (daftar server)
store.html           ← Template store — dipakai semua server lewat ?server=slug
data.json            ← Semua data (server, rank, key, network) — ini "database"-nya
style.css            ← Tema merah + liquid glass
script.js            ← Render lobby/store, sound, player count, form beli + Discord webhook

admin/
  index.html          ← Login admin
  admin-config.js      ← 🔑 SET USERNAME & PASSWORD ADMIN DI SINI
  dashboard.html        ← Panel tambah store/item
  admin.js               ← Logic dashboard

assets/
  sounds/click.mp3      ← taruh sendiri
  images/<slug>/...png  ← taruh sendiri, satu folder per store
```

## Cara deploy ke GitHub Pages

1. Push semua folder ini ke repo GitHub kamu.
2. Repo → **Settings → Pages** → Source: pilih branch `main`, folder `/ (root)`.
3. Tunggu 1–2 menit, website hidup di `https://<username>.github.io/<repo>/`.

## Login Admin

Buka `admin/index.html`, atau tombol **Admin** di footer lobby.

Username/password default ada di `admin/admin-config.js`:
```js
const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "gantipassword123"
};
```
**Ganti password ini sebelum publish!**

⚠️ Ini website statis — tidak ada server yang menyembunyikan password. Siapapun yang buka file `admin-config.js` lewat "View Source" bisa baca username/password-nya. Panel ini cukup untuk mencegah pengunjung iseng, tapi bukan keamanan tingkat bank. Jangan pakai password yang dipakai di akun lain.

## Cara kerja Admin Dashboard

Dashboard mengedit **draft** yang tersimpan di `localStorage` browser kamu — belum langsung tampil ke pengunjung lain. Setelah selesai edit (tambah store/rank/key), publish salah satu cara:

- **Download & Upload manual** (paling aman, tanpa token): klik "Download data.json", lalu upload/replace file itu di repo GitHub kamu lewat web (drag & drop → commit). GitHub Pages update otomatis.
- **Publish langsung ke GitHub** (lebih cepat, opsional): isi owner/repo/branch + GitHub Personal Access Token (scope `repo`), klik Publish. Token hanya dipakai di browser saat itu saja, tidak disimpan.

## Purchase flow

Klik "Buy Now" pada rank/key → isi Nickname Minecraft + Platform (Java/Bedrock) → sistem kirim notifikasi ke Discord webhook (kalau sudah di-set di Pengaturan Network) → pengunjung diarahkan ke link donate Sociabuzz FaridSmp untuk bayar.

Set Discord Webhook URL di Admin Dashboard → Pengaturan Network. Cara bikin webhook: Discord → Server Settings → Integrations → Webhooks → New Webhook → Copy URL.

## Live player count

Diambil otomatis dari `api.mcsrvstat.us` berdasarkan IP:port tiap server di `data.json`. Kalau server offline atau API tidak bisa diakses, otomatis fallback tanpa error.
