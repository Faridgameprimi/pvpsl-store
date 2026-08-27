# FaridSmp Store V2

Tema: merah + liquid glass.

## Admin login
Edit `script.js`:
```js
const ADMIN_USER="admin";
const ADMIN_PASS="CHANGE_ME_123";
```
Ganti kedua nilai tersebut sebelum upload ke GitHub.

**Penting:** karena website ini hanya memakai GitHub Pages/static files, login admin bersifat client-side dan bukan sistem keamanan sungguhan. Username/password tetap bisa dilihat dari source JavaScript oleh orang yang membuka situs. Jangan gunakan password penting.

## Store manager
`admin.html` bisa:
- tambah/hapus store
- tambah/hapus item
- ubah nama dan harga item
- ubah Discord dan link Sociabuzz
- export/import JSON

Perubahan admin disimpan di `localStorage` browser admin. Jadi perubahan tidak otomatis tampil di perangkat pengunjung.

Untuk perubahan permanen yang dilihat semua orang, data perlu dimasukkan ke `DEFAULT_DATA` di `script.js` lalu commit/push ke GitHub.

## Checkout
Saat Buy:
1. isi nama Minecraft
2. pilih Java/Bedrock
3. pilih jumlah
4. copy detail order
5. buka Sociabuzz FaridSmp
6. buka Discord untuk mengirim detail order ke staff

Sociabuzz:
https://sociabuzz.com/faridsmp/tribe

Discord lobby:
https://discord.gg/TUhjeUTvhh

## Discord automation
Website static GitHub Pages tidak bisa mengirim order ke Discord secara aman tanpa backend/proxy. Jangan menaruh Discord bot token atau webhook rahasia di JavaScript publik.
