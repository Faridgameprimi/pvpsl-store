# FaridSmp Store

Website + 2 panel admin (Site Admin & Payment Admin) + auto-delivery ke Minecraft (via verifikasi manual), di-host di **Vercel**.

## Alur (manual verification)

```
Pembeli klik "Buy Now" di website
   → isi Nickname + Platform (Java/Bedrock)
   → website tunjuk NAMA yang wajib dipakai di Sociabuzz
     (Java: nama apa adanya, Bedrock: tambah _ di depan)
     + contoh pesan yang disarankan
   → pembeli copy nama & pesan itu ke Sociabuzz, lalu bayar
        ↓
Sociabuzz kirim Webhook ke /api/sociabuzz-webhook
   → ambil Nama + Pesan dari Sociabuzz
   → tebak platform dari awalan "_" di nama
   → SELALU masuk "Order Menunggu Verifikasi" (payment-review.json)
   → notif Discord "order masuk, perlu verifikasi"
        ↓
Admin buka PAYMENT ADMIN (login terpisah dari Site Admin)
   → baca Nama + Pesan, cek jumlah bayaran di dashboard Sociabuzz sendiri
   → pilih item yang sesuai dari dropdown, cek/betulkan nickname & platform
   → cocok? klik Accept — tidak cocok/mencurigakan? klik Deny
        ↓
Order yang di-Accept masuk antrian (pending-orders.json)
        ↓
Plugin Minecraft polling /api/pending-orders tiap 15 detik
   → jalankan command sesuai config.yml
   → tandai selesai lewat /api/mark-fulfilled
```

Admin juga bisa **kasih rank/key langsung** (tanpa lewat Sociabuzz sama sekali) lewat Payment Admin → "Beri Rank/Key Manual" — untuk pembayaran cash/transfer manual.

## Struktur

```
index.html / store.html / style.css / script.js   ← Website publik
data.json                                            ← Data server/rank/key (public)
pending-orders.json                                   ← Antrian delivery (plugin baca dari sini)
payment-review.json                                    ← Antrian verifikasi (Payment Admin baca dari sini)

admin/                    ← SITE ADMIN — kelola store/rank/key/gambar
  index.html                → Login
  dashboard.html              → Tambah/Edit Store & Item, upload gambar, publish
  admin.js

payment-admin/             ← PAYMENT ADMIN — login TERPISAH, kelola pembayaran ⭐ BARU
  index.html                  → Login (kredensial beda dari Site Admin)
  dashboard.html                → Accept/Deny order, kasih rank/key manual
  payment-admin.js

api/
  login.js                        ← Login Site Admin
  publish.js                       ← Commit data.json ke GitHub
  upload-image.js                   ← Upload PNG ke GitHub (rank & key)
  notify-discord.js                  ← Notif Discord dari form beli
  sociabuzz-webhook.js                ← Terima webhook Sociabuzz → payment-review.json
  payment-login.js                      ← Login Payment Admin ⭐ BARU
  review-orders.js                       ← Payment Admin ambil daftar order ⭐ BARU
  review-action.js                        ← Accept/Deny order ⭐ BARU
  manual-grant.js                          ← Kasih rank/key manual (tanpa Sociabuzz) ⭐ BARU
  pending-orders.js                         ← Plugin Minecraft polling dari sini
  mark-fulfilled.js                          ← Plugin Minecraft tandai selesai

lib/
  auth.js           ← Session token (2 role terpisah: admin & payment) + plugin key
  github.js          ← Baca/tulis file JSON ke GitHub repo

minecraft-plugin/   ← Source code plugin Java (Paper 1.21.11) — kena compile sendiri
```

## Setup Environment Variables (Vercel)

| Nama | Contoh | Fungsi |
|---|---|---|
| `ADMIN_USERNAME` | `Mrfarid` | Login Site Admin |
| `ADMIN_PASSWORD` | `farid255` | Login Site Admin |
| `ADMIN_SECRET` | *(random string A)* | Sign token Site Admin |
| **`PAYMENT_ADMIN_USERNAME`** ⭐ | *(bebas, beda dari Site Admin)* | Login Payment Admin |
| **`PAYMENT_ADMIN_PASSWORD`** ⭐ | *(bebas, beda dari Site Admin)* | Login Payment Admin |
| **`PAYMENT_ADMIN_SECRET`** ⭐ | *(random string B, BEDA dari ADMIN_SECRET)* | Sign token Payment Admin |
| `GITHUB_TOKEN` | `ghp_xxx` | Commit ke repo |
| `GITHUB_OWNER` | `Faridgameprimi` | Username GitHub |
| `GITHUB_REPO` | `pvpsl-store` | Nama repo |
| `GITHUB_BRANCH` | `main` | Branch |
| `DISCORD_WEBHOOK_URL` | `https://discord.com/api/webhooks/...` | Notifikasi order |
| `SOCIABUZZ_WEBHOOK_TOKEN` | *(random string C)* | Verify webhook dari Sociabuzz |
| `PLUGIN_API_KEY` | *(random string D)* | Auth plugin Minecraft ke API |

**Semua random string (A/B/C/D) harus BEDA-BEDA satu sama lain.** Generate di [randomkeygen.com](https://randomkeygen.com).

Habis isi/ubah env var → **Redeploy** project di Vercel.

## Kenapa harus 2 login admin terpisah?

- **Site Admin** (`/admin/`) → kelola tampilan & katalog toko (nama, harga, gambar, deskripsi). Orang yang urus konten website.
- **Payment Admin** (`/payment-admin/`) → kelola verifikasi uang masuk & pengiriman rank/key. Orang yang urus transaksi.

Dua akses ini sengaja dipisah token & secret-nya — orang yang pegang password Site Admin (misal admin konten/desainer) **tidak otomatis** bisa Accept/Deny pembayaran, dan sebaliknya. Kalau di server kamu cuma 1 orang yang urus semua, tetap boleh pakai kedua-duanya, cuma login-nya beda halaman.

## Setup Sociabuzz Webhook

1. Login [sociabuzz.com](https://sociabuzz.com) → TRIBE page kamu → **Edit & Settings**
2. **Integrations** → **Webhook** → aktifkan
3. **Webhook URL**: `https://pvpsl-store.vercel.app/api/sociabuzz-webhook`
4. **Webhook Token**: samakan dengan env var `SOCIABUZZ_WEBHOOK_TOKEN`
5. **Test Notification**

⚠️ Format payload webhook Sociabuzz tidak didokumentasikan lengkap ke publik — kode parsing di `sociabuzz-webhook.js` defensif (coba beberapa nama field umum). Setelah order beneran masuk (bukan cuma test), cek apakah field Amount/Supporter kebaca benar di Payment Admin. Kalau ada yang aneh, cek log function di Vercel dan kabari saya.

## Format Nama Java/Bedrock

Sociabuzz bukan checkout berbasis API, jadi tidak ada cara "kirim data pesanan" langsung ke Sociabuzz. Solusinya: pembeli menulis **nickname Minecraft mereka sendiri sebagai Nama** di Sociabuzz, dengan aturan:

- **Java** → nama apa adanya, contoh: `andi`
- **Bedrock** → tambah underscore `_` di depan, contoh: `_andi`

Website otomatis kasih tau format yang benar (sesuai platform yang mereka pilih di form) plus contoh pesan yang disarankan (misalnya "Beli Weekly Plus Pass x1") — tinggal copy-paste ke Sociabuzz. Webhook otomatis tebak platform dari awalan `_` itu, tapi **admin tetap yang pilih item-nya secara manual** di Payment Admin sebelum Accept — sistem ini sengaja tidak coba nebak item secara otomatis, karena pesan donasi sifatnya bebas/tidak terstruktur.

## Setup Plugin Minecraft

Lihat `minecraft-plugin/README.md`. **Tidak berubah** dari sebelumnya — plugin tetap polling `/api/pending-orders` dan `/api/mark-fulfilled`, cuma sekarang isi antrian itu berasal dari order yang sudah di-Accept admin (bukan langsung dari webhook).

## Site Admin — fitur baru

- **Upload gambar PNG untuk Rank juga**, bukan cuma Key
- **Edit item** — klik "Edit" di daftar item, form otomatis keisi, submit untuk simpan perubahan (bukan bikin item baru)

## Live player count

Diambil otomatis dari `api.mcsrvstat.us` berdasarkan IP:port tiap server di `data.json`.
