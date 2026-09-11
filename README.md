# WA Bot Grup

Bot WhatsApp fokus untuk grup tertentu saja (nomor bot boleh ada di banyak grup, tapi bot cuma aktif/respon di grup yang sudah didaftarkan lewat `.addgrup`).

## Fitur yang sudah jalan
- Login pakai **pairing code** (bukan scan QR)
- Auto balas saat ada member **masuk** dan **keluar** grup
- `.menu` → kirim foto (dari `assets/menu.jpg`) + caption isi `.setting` dan `.game`
- `.setting` (khusus owner) → daftar semua perintah setting
- `.addgrup` / `.dellgrup` → daftarkan/hapus grup dari daftar aktif bot
- `.tutup` / `.buka` → grup jadi hanya-admin / semua-bisa-chat
- `.addwelcome <teks>` / `.dellwelcome` → atur pesan welcome custom (pakai `@user` untuk mention otomatis)
- `.addlave <teks>` / `.delllave` → atur pesan leave custom
- `.game` → placeholder dulu, nanti diisi daftar game HTML

## Cara pakai

1. Install Node.js versi 18 ke atas.
2. Masuk ke folder project, install dependency:
   ```
   npm install
   ```
3. Buka `config.json`, atur semua setting global di sini:
   ```json
   {
     "ownerNumber": "628xxxxxxxxxx",
     "botName": "Bot Grup",
     "prefix": ".",
     "menuImage": "assets/menu.jpg",
     "defaultWelcomeText": "Selamat datang @user di grup ini!",
     "defaultLeaveText": "Selamat tinggal @user, semoga sukses selalu!"
   }
   ```
   - `ownerNumber` → nomor WA kamu (tanpa `+`/spasi). Cuma nomor ini yang boleh pakai `.setting` dan turunannya.
   - `prefix` → simbol perintah, default `.` — bisa diganti misal `!` kalau mau.
   - `menuImage` → path gambar yang dikirim saat `.menu`.
   - `defaultWelcomeText` / `defaultLeaveText` → dipakai kalau grup belum set pesan custom lewat `.addwelcome`/`.addlave`.
4. Taruh gambar menu di `assets/menu.jpg` (atau path lain sesuai `menuImage` di config).
5. Jalankan bot:
   ```
   npm start
   ```
6. Di **console/terminal** akan muncul permintaan **nomor WA bot** (nomor yang mau dipakai jadi bot, boleh beda dari nomor owner). Masukkan nomornya.
7. Bot akan menampilkan **kode pairing 8 digit langsung di console**. Buka WhatsApp di HP kamu → Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon → masukkan kode itu.
8. Setelah tersambung, masuk ke grup yang mau dipakai, kirim `.addgrup` (dari nomor owner) supaya bot aktif di grup itu.

## Struktur data
Semua data disimpan otomatis di folder `data/` dalam bentuk JSON:
- `groups.json` — daftar grup yang aktif
- `welcome.json` — pesan welcome per grup
- `leave.json` — pesan leave per grup
- `status.json` — status buka/tutup per grup

Session login WhatsApp disimpan di folder `session/` (jangan dihapus kalau tidak mau pairing ulang, dan jangan dibagikan ke siapa pun).

## Lanjutan (.game)
`.game` sekarang masih placeholder. Nanti bisa dikembangkan supaya mengirim list game berbasis HTML — kabari kalau sudah siap lanjut ke bagian ini.
