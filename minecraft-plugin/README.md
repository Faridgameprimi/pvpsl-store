# FaridSmp Order Delivery Plugin

Plugin Minecraft (Paper/Spigot) yang polling website FaridSmp tiap beberapa detik, dan otomatis jalankan command (kasih rank/key) waktu ada order yang sudah dibayar via Sociabuzz.

## Cara Build (jadi .jar)

Butuh **Java 21** (bukan 17 — server 1.21.11 kamu perlukan Java 21) dan **Maven** ter-install.

```bash
cd minecraft-plugin
mvn clean package
```

File jadi ada di `target/orderdelivery.jar`.

Kalau server kamu **Spigot/Bukkit biasa** (bukan Paper), buka `pom.xml`, tukar repository & dependency `paper-api` ke:
```xml
<repository>
    <id>spigot-repo</id>
    <url>https://hub.spigotmc.org/nexus/content/repositories/snapshots/</url>
</repository>
```
```xml
<dependency>
    <groupId>org.spigotmc</groupId>
    <artifactId>spigot-api</artifactId>
    <version>1.20.4-R0.1-SNAPSHOT</version>
    <scope>provided</scope>
</dependency>
```

Tak ada Maven/Java di komputer sendiri? Boleh compile pakai:
- **IntelliJ IDEA** (Community edition, free) — buka folder `minecraft-plugin`, dia auto-detect Maven project, tinggal klik "Package"
- Atau minta tolong orang yang ada dev environment — semua source code dah lengkap di sini, tinggal `mvn package`

## Cara Install

1. Copy `orderdelivery.jar` ke folder `plugins/` server Minecraft kamu
2. Restart/reload server → folder `plugins/FaridSmpOrderDelivery/` akan ke-generate, ada `config.yml` di dalamnya
3. Edit `config.yml`:
   - `api.base-url` → domain Vercel kamu (contoh `https://pvpsl-store.vercel.app`)
   - `api.plugin-key` → **harus sama persis** dengan env var `PLUGIN_API_KEY` di Vercel
   - `items` → mapping item id ke command (lihat contoh dalam file, sesuaikan dengan plugin economy/permission/crate yang kamu pakai)
4. `/fsorders reload` di console, atau restart server

## Cara Test

1. `/fsorders check` — paksa plugin cek order sekarang juga (jangan tunggu interval)
2. Lihat console log — kalau ada order pending, akan muncul log "Order ... delivered"
3. Kalau muncul warning "Tidak ada mapping command untuk item id" — artinya `items` di config.yml belum ada entry untuk item id itu. Copy id-nya dari Admin Dashboard → "Store & Item Sekarang", tambah ke config.yml, reload.

## Catatan Penting

- Command yang butuh player **online** (contoh `/give`) cuma jalan kalau nickname itu lagi online waktu plugin poll. Command dari plugin economy/permission (LuckPerms, Vault-based economy) biasanya tetap jalan walau player offline.
- Kalau item id belum ada mapping-nya, order itu **tidak** ditandai selesai — plugin akan terus coba tiap poll sampai kamu tambah mapping-nya. Order tidak akan "hilang".
- Plugin ini cuma proses order yang sudah lolos verifikasi format kode order (`[FARIDSMP-ORDER] ...`) di website. Order yang formatnya tidak ke-detect otomatis masuk status "perlu cek manual" dan dikirim ke Discord kamu untuk diproses tangan.
