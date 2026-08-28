# FaridSmp Store

Website + admin panel, di-host di **Vercel**. Bahagian publik (`index.html`, `store.html`) statis; bahagian admin (`admin/`) dibantu oleh serverless functions di `api/` supaya password, GitHub token, dan link webhook Discord **tidak pernah nampak di browser** — semua rahsia itu disimpan sebagai Environment Variable di Vercel.

## Struktur

```
index.html              ← Lobby (render server dari data.json)
store.html               ← Template store — dipakai semua server via ?server=slug
data.json                 ← "Database" — data server/rank/key/network (public, tak sensitif)
style.css                  ← Tema merah + liquid glass
script.js                   ← Render lobby/store, sound, player count, form beli

admin/
  index.html                ← Login admin (panggil /api/login)
  dashboard.html              ← Panel tambah store/item, upload gambar, publish
  admin.js                     ← Logic dashboard

api/                         ← Serverless functions (jalan di server, bukan browser)
  login.js                     ← Cek username/password, keluarkan session token
  publish.js                    ← Commit data.json ke GitHub (guna token server)
  upload-image.js                ← Upload PNG ke GitHub (guna token server)
  notify-discord.js               ← Hantar notifikasi order ke Discord webhook

lib/auth.js                  ← Helper sign/verify session token
package.json

assets/
  sounds/click.mp3           ← taruh sendiri
  images/<slug>/...png        ← auto ke-upload lewat Admin Dashboard, atau taruh manual
```

## Setup wajib — Environment Variables di Vercel

Buka **Vercel Dashboard → Project kamu → Settings → Environment Variables**, tambah semua ni:

| Nama | Contoh isi | Fungsi |
|---|---|---|
| `ADMIN_USERNAME` | `Mrfarid` | Username login admin |
| `ADMIN_PASSWORD` | `farid255` | Password login admin |
| `ADMIN_SECRET` | *(random string panjang)* | Untuk sign session token — jangan share, jangan pakai contoh di bawah |
| `GITHUB_TOKEN` | `ghp_xxxxxxxxxxxx` | Personal Access Token (scope `repo`) — dipakai server untuk commit |
| `GITHUB_OWNER` | `Faridgameprimi` | Username GitHub kamu |
| `GITHUB_REPO` | `pvpsl-store` | Nama repo (bukan URL — nama saja) |
| `GITHUB_BRANCH` | `main` | Branch yang dipakai (opsional, default `main`) |
| `GITHUB_DATA_PATH` | `data.json` | Lokasi data.json dalam repo (opsional, default `data.json`) |
| `DISCORD_WEBHOOK_URL` | `https://discord.com/api/webhooks/...` | Notifikasi order masuk (opsional — kosongkan kalau tak nak) |

Contoh nilai random untuk `ADMIN_SECRET` (boleh pakai ni, atau generate sendiri, yang penting **jangan share ke sesiapa**):
```
63957b57e6ecefa208ea29f8c388e7862484eccf96708aa4b4e86b78f7b73dad
```

Lepas isi semua env var, **redeploy** project (Vercel → Deployments → titik tiga → Redeploy) supaya env var-nya kebaca.

⚠️ Env var ini **beza** dengan file kod biasa — dia tersimpan encrypted kat server Vercel, **tidak** masuk repo GitHub, dan **tidak** boleh dibaca dari browser/View Source. Ini jauh lebih selamat berbanding letak password terus dalam fail `.js`.

## Cara login admin

Buka `/admin/index.html` (atau tombol "Admin" di footer lobby) → masuk dengan username/password yang kamu set di `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Cara kerja Admin Dashboard

1. Semua perubahan (tambah store, tambah rank/key, upload gambar) disimpan sebagai **draft** di `localStorage` browser kamu dulu.
2. Bila upload gambar PNG untuk key, gambar terus ter-upload ke GitHub repo kamu (folder `assets/images/<slug-store>/`) — tak payah upload manual lagi.
3. Bila siap edit, klik **"🚀 Publish ke GitHub"** — server yang urus commit `data.json` guna token yang tersimpan di env var, admin **tidak perlu** isi token apa-apa lagi.
4. Kalau nak cara manual (tanpa Vercel/API, contoh untuk backup), boleh "⬇ Download data.json" lalu upload sendiri ke GitHub.

## Purchase flow

Klik "Buy Now" pada rank/key → isi Nickname Minecraft + Platform (Java/Bedrock) → sistem panggil `/api/notify-discord` (webhook URL-nya tersembunyi di server, tak nampak di browser pembeli) → pengunjung diarahkan ke link donate Sociabuzz FaridSmp.

Cara bikin Discord webhook: Discord → Server Settings → Integrations → Webhooks → New Webhook → Copy URL → paste sebagai `DISCORD_WEBHOOK_URL` di Vercel.

## Live player count

Diambil otomatis dari `api.mcsrvstat.us` berdasarkan IP:port tiap server di `data.json`. Kalau server offline atau API tidak bisa diakses, otomatis fallback tanpa error.

## Kenapa perlu Vercel (bukan GitHub Pages je)

GitHub Pages 100% statis — tidak boleh jalankan kod server, jadi tidak boleh sembunyikan password/token langsung. Vercel boleh jalankan **serverless functions** (folder `api/`), jadi rahsia-rahsia tu boleh disimpan betul-betul di server. Struktur website (`index.html`, `data.json`, dll) tetap sama macam biasa — cuma bahagian admin yang sekarang dibantu oleh function tersebut.
