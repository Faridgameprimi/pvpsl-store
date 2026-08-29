# FaridSmp Store

Website + admin panel + auto-delivery ke Minecraft, di-host di **Vercel**.

## Alur Auto-Delivery (baru)

```
Pembeli klik "Buy Now"
   → isi Nickname + Platform
   → dapat KODE ORDER unik (copy)
   → paste kode itu di kolom pesan/catatan Sociabuzz
   → bayar di Sociabuzz
        ↓
Sociabuzz kirim Webhook ke /api/sociabuzz-webhook
   → verify token, parse kode order dari catatan
   → simpan ke antrian (pending-orders.json di GitHub)
   → notif Discord "order masuk"
        ↓
Plugin Minecraft (jalan di server game) polling /api/pending-orders
   tiap 15 detik
   → jalankan command (kasih rank/key) sesuai mapping di config.yml
   → tandai order selesai lewat /api/mark-fulfilled
```

## Struktur

```
index.html / store.html / style.css / script.js   ← Website publik
data.json                                            ← Data server/rank/key (public)
pending-orders.json                                   ← Antrian order (auto-generate, jangan edit manual)

admin/            ← Panel admin (login, dashboard, upload gambar, publish)

api/
  login.js                 ← Login admin
  publish.js                ← Commit data.json ke GitHub
  upload-image.js            ← Upload PNG ke GitHub
  notify-discord.js           ← Notif Discord saat form beli di-submit di website
  sociabuzz-webhook.js         ← Terima webhook Sociabuzz saat bayar berhasil ⭐ BARU
  pending-orders.js             ← Plugin Minecraft polling order dari sini ⭐ BARU
  mark-fulfilled.js              ← Plugin Minecraft tandai order selesai ⭐ BARU

lib/
  auth.js           ← Session token admin + plugin key check
  github.js          ← Baca/tulis file JSON ke GitHub repo (dipakai banyak endpoint)

minecraft-plugin/   ← Source code plugin Java (Paper/Spigot) — kena di-compile sendiri ⭐ BARU
  README.md           ← Cara build & install plugin-nya
  pom.xml
  src/...
```

## Setup Environment Variables (Vercel)

Sama seperti sebelum, **plus 3 baru**:

| Nama | Contoh | Fungsi |
|---|---|---|
| `ADMIN_USERNAME` | `Mrfarid` | Login admin |
| `ADMIN_PASSWORD` | `farid255` | Login admin |
| `ADMIN_SECRET` | *(random string)* | Sign session token admin |
| `GITHUB_TOKEN` | `ghp_xxx` | Commit ke repo (data.json, gambar, antrian order) |
| `GITHUB_OWNER` | `Faridgameprimi` | Username GitHub |
| `GITHUB_REPO` | `pvpsl-store` | Nama repo |
| `GITHUB_BRANCH` | `main` | Branch |
| `DISCORD_WEBHOOK_URL` | `https://discord.com/api/webhooks/...` | Notifikasi order |
| **`SOCIABUZZ_WEBHOOK_TOKEN`** ⭐ | *(random string)* | Verify webhook beneran dari Sociabuzz |
| **`PLUGIN_API_KEY`** ⭐ | *(random string, beda dari yang lain)* | Auth plugin Minecraft ke API |
| `ORDERS_DATA_PATH` | `pending-orders.json` | Opsional, lokasi file antrian |

Generate random string (untuk `ADMIN_SECRET`, `SOCIABUZZ_WEBHOOK_TOKEN`, `PLUGIN_API_KEY` — **pakai string BEDA-BEDA untuk masing-masing**, jangan sama):
- Buka [randomkeygen.com](https://randomkeygen.com) → copy salah satu "CodeIgniter Encryption Keys" atau sejenis
- Atau di HP: cari "random password generator 64 character"

Habis isi env var → **Redeploy** project di Vercel.

## Setup Sociabuzz Webhook

1. Login [sociabuzz.com](https://sociabuzz.com) → buka page TRIBE kamu → **Edit & Settings**
2. **Integrations** → **Webhook**
3. **Activate Webhook Integration** → ON
4. **Webhook URL**: `https://pvpsl-store.vercel.app/api/sociabuzz-webhook`
5. **Webhook Token**: isi string yang **sama persis** dengan env var `SOCIABUZZ_WEBHOOK_TOKEN` di Vercel
6. Klik **Test Notification** untuk pastikan konek

⚠️ Sociabuzz tidak publish dokumentasi format payload webhook secara lengkap ke publik, jadi `api/sociabuzz-webhook.js` ditulis defensif (coba beberapa nama field yang umum dipakai). Kalau setelah test ada masalah field tidak ke-detect, cek log function di Vercel (Deployments → pilih deployment → Functions → `sociabuzz-webhook`) untuk lihat payload asli yang dikirim Sociabuzz, kabari saya biar disesuaikan.

## Setup Plugin Minecraft

Lihat `minecraft-plugin/README.md` — ada panduan build (`mvn clean package`) dan install lengkap.

Poin penting: `api.plugin-key` di `config.yml` plugin **harus sama persis** dengan env var `PLUGIN_API_KEY` di Vercel.

## Kode Order — kenapa penting

Sociabuzz bukan API-based checkout (bukan macam Midtrans/Stripe), jadi kita tidak bisa "kirim" data pesanan ke Sociabuzz waktu checkout. Solusinya: website generate **kode order unik** (contoh `[FARIDSMP-ORDER] item=amethyst-key-a1b2;qty=5;nick=Steve123;platform=Java`) yang pembeli **paste sendiri** ke kolom pesan/catatan Sociabuzz waktu donasi. Kode ini yang dibaca sistem untuk tau siapa beli apa.

Kalau pembeli lupa/salah paste kode itu, order otomatis masuk status "perlu cek manual" dan admin dapat notif Discord untuk diproses manual.

## Admin Dashboard — tidak berubah

Tambah store/rank/key, upload gambar, publish — semua sama seperti sebelum.

## Live player count

Diambil otomatis dari `api.mcsrvstat.us` berdasarkan IP:port tiap server di `data.json`.
