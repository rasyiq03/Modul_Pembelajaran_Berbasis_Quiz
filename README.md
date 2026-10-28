# Modul Pembelajaran Berbasis Kuis (KuisKelas)

Kumpulan modul pembelajaran. Setiap modul adalah **satu file HTML mandiri** berisi rangkuman materi, lab interaktif, dan kuis gaya Kahoot. Repo ini punya dua lapis:

| Lapis | Berkas | Butuh internet? | Isi |
|---|---|---|---|
| **Materi (offline)** | `<Mata Kuliah>/*.html` | Tidak | Rangkuman, lab, bank soal, latihan solo melawan bot, profil, XP, level, lencana |
| **KuisKelas Online** | `index.html` + `online/` | Ya (Supabase) | Katalog semua materi, room kelas dengan PIN, layar pengajar, peringkat XP kelas, rekap nilai CSV |
| **Platform web** | `web/` (Next.js) | Ya (Supabase) | Akun & admin, katalog mata kuliah, pembaca materi aman, enrollment key, bank soal, kuis mandiri & live. Lihat [`web/README.md`](web/README.md) |

File materi tidak tahu apa pun tentang mode online. KuisKelas Online **membaca** soal dari file materi (lewat `materi.json`) tanpa mengubahnya, lalu menyimpan soal itu ke room. Jadi:

- File materi bisa dikirim lewat WhatsApp, flashdisk, atau LMS dan dibuka tanpa internet.
- Peserta room cukup membuka `index.html` dan memasukkan PIN. Mereka tidak perlu memegang file materi.
- Profil, XP, dan lencana dipakai bersama. Keduanya memakai `localStorage` dengan awalan `kq:`, jadi XP dari latihan solo ikut terhitung di peringkat kelas selama dibuka dari situs yang sama (misalnya GitHub Pages).

```
.
├── index.html                 ← KuisKelas Online (hub)
├── materi.json                ← daftar materi, dibuat otomatis
├── engine/
│   ├── kuiskelas.js           ← sumber mesin offline (disalin ke setiap materi)
│   └── kuiskelas.css
├── online/
│   ├── config.js              ← isi kredensial Supabase di sini
│   ├── kuiskelas-online.js    ← mesin mode online
│   ├── kuiskelas-online.css
│   └── schema.sql             ← skema database + fungsi + keamanan (RLS)
├── tools/kuiskelas.py         ← sinkron mesin & manifest
├── web/                       ← platform Next.js (memakai proyek Supabase yang sama)
└── <Mata Kuliah>/*.html       ← materi
```

## Memakai

**Siswa, belajar mandiri:** buka file materi mana saja, misalnya dengan klik dua kali. Tab **Kuis** → **Latihan solo**.

**Kelas, main bareng:**
1. Pengajar membuka `index.html`, memilih materi di katalog, lalu **Buat room**. Pengajar juga bisa memakai **Pakai file materi…** untuk file yang belum ada di katalog.
2. Layar pengajar menampilkan PIN dan tautan `…/index.html#join=PIN`.
3. Peserta membuka tautan itu di HP (atau `index.html` → **Gabung room**) dan mengisi nama panggilan, NIM, dan kode kelas.
4. Setelah selesai, pengajar bisa mengunduh nilai (CSV). Riwayat sesi ada di **Peringkat & rekap**.

## Mengaktifkan mode online (sekali saja)

`online/config.js` sudah berisi proyek Supabase `pwkpanjngtjnujyuctxl`, yang juga dipakai platform `web/`. Tabel KuisKelas berawalan `kq_` (`kq_profiles`, `kq_rooms`, dan seterusnya), jadi tidak bentrok dengan tabel platform.

1. **Authentication → Sign In / Providers →** aktifkan *Allow anonymous sign-ins*.
2. **SQL Editor →** jalankan `online/schema.sql`. Kalau platform web juga dipasang, cukup jalankan semua file `web/supabase/migrations/` berurutan, karena file terakhirnya adalah salinan persis `online/schema.sql`. Semuanya aman dijalankan ulang.
3. Bila memakai proyek lain, ganti *Project URL* dan *anon public key* di `online/config.js`.
4. Unggah repo ke hosting statis, misalnya **GitHub Pages** (Settings → Pages → branch `main`, folder `/`). Bagikan alamat `https://<user>.github.io/<repo>/`.

Anon key memang boleh publik. Keamanan data dijaga oleh `schema.sql`:
- Tabel tidak bisa ditulis langsung. Semua perubahan lewat fungsi server (`kq_create_room`, `kq_join_room`, `kq_submit_answer`, `kq_host_advance`, `kq_sync_profile`).
- Kunci jawaban dan pembahasan disimpan terpisah dan baru dibuka per soal setelah soal ditutup (`kq_room_reveal`). Skor dihitung di server.
- NIM peserta hanya bisa dibaca oleh pemandu room. Peringkat XP kelas tidak memuat NIM.
- Rekap nilai per sesi hanya terlihat dari perangkat (sesi login anonim) yang memandu sesi itu.

## Menambah atau mengubah materi

1. Salin salah satu file materi sebagai templat, lalu ganti isi `<main id="view-summary">` dan `window.COURSE` (id, judul, soal).
2. Jalankan:

   ```bash
   python3 tools/kuiskelas.py          # sinkron mesin ke semua materi + perbarui materi.json
   python3 tools/kuiskelas.py check    # mesin terbaru, manifest mutakhir, migrasi KuisKelas di web/ = online/schema.sql
   ```

Perintah ini hanya mengganti blok mesin (di antara penanda `<!-- KUISKELAS:ENGINE-CSS -->` dan `<!-- KUISKELAS:ENGINE-JS -->`). Isi materi, soal, dan skrip khusus materi tidak disentuh. Mesin diubah di `engine/`, bukan di file materi.

Format soal di `window.COURSE.questions`:

```js
{ topic: "Kejadian bebas", ref: "s2", time: 25, hots: false,
  q: "Teks soal (boleh <b>, <i>, <sub>, <sup>, <code>)",
  o: ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],   // tepat 4
  a: 0,                                          // indeks kunci 0–3
  e: "Pembahasan singkat" }
```

`ref` menunjuk `id` bab (`<section id="s2">`). Bab ini dipakai untuk saran "Baca lagi bab ini" di hasil kuis.

## Catatan

- `pcd-01` dan `pcd-02` masih memakai format kuis lama (tanpa mesin KuisKelas). Keduanya tetap bisa dipakai offline, dan KuisKelas Online tetap bisa membuat room dari soalnya. Fitur profil, XP, dan lencana di file itu baru aktif setelah dipindah ke format `window.COURSE`.
- Beberapa `COURSE.id` tidak sama dengan nama filenya (misalnya `kwu-03` ber-id `kwu-01-design-thinking`). Id dipakai sebagai kunci progres baca dan XP. Mengubahnya membuat progres lama di perangkat siswa tidak terbaca lagi, jadi biarkan kecuali memang ingin mulai dari nol.
