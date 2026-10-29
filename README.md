# KuisKelas: Modul Pembelajaran Berbasis Kuis

Platform web (Next.js + Supabase) untuk materi kuliah interaktif. Setiap materi adalah satu file HTML
mandiri berisi rangkuman, lab interaktif, dan kuis bergaya Kahoot. Platform menambahkan akun dan
admin, katalog, pembaca materi yang aman, enrollment key per materi, bank soal, kuis mandiri, dan
kuis live dengan kode sesi.

File HTML materi tetap bisa dibuka offline (klik dua kali, kirim lewat WhatsApp/LMS). Platform
membaca isi dan soalnya tanpa mengubah file tersebut.

## Struktur

```
.
├── app/                      Next.js App Router (halaman & route handler)
│   ├── (publik)              /, /courses, /materials, /quizzes, /join, /play/[id], /attempts/[id]
│   ├── dashboard/            dashboard, riwayat kuis, materi saya, profil (pengguna terdaftar)
│   ├── admin/                ringkasan, mata kuliah, materi, enrollment key, bank soal, kuis,
│   │                         sesi live, hasil & analitik, pengguna (khusus admin)
│   ├── m/[token]/[...path]/  pembaca materi: isi bucket privat dilayani setelah akses diperiksa
│   └── auth/callback/        tautan konfirmasi email Supabase
├── components/               komponen UI (ui/ = shadcn), admin/, quiz/, live/, materials/, site/
├── lib/                      klien Supabase, auth, tipe database, label, CSV, logika kuis
├── middleware.ts             menyegarkan sesi & melindungi /dashboard dan /admin
├── supabase/migrations/      skema, RLS, dan fungsi RPC (jalankan berurutan)
├── content/                  sumber konten (tidak ikut dibundel ke aplikasi)
│   ├── courses.json          daftar mata kuliah; slug = nama folder di materials/
│   ├── engine/               mesin materi offline (kuiskelas.js/.css), disalin ke setiap materi
│   └── materials/<slug>/     file HTML materi per mata kuliah
└── scripts/                  alat konten: sinkron mesin, pemeriksaan, impor ke Supabase
```

## Fitur (ringkas)

| Area | Isi |
|---|---|
| Akun | Daftar, masuk/keluar, profil & ganti kata sandi, peran admin (diberikan lewat SQL), tamu anonim untuk kuis |
| Materi | Katalog & pencarian, detail dengan tujuan pembelajaran, pratinjau publik, materi lengkap hanya untuk yang ter-enroll, pembaca HTML ter-sandbox (lab & kuis tertanam tetap jalan), unggah HTML + aset, status draf/terpublikasi/diarsipkan |
| Enrollment key | Satu key untuk satu materi; masa berlaku & batas pemakaian; cabut key; cabut/pulihkan akses per pengguna; key disimpan sebagai hash |
| Bank soal | 7 jenis (pilihan tunggal, pilihan jamak, benar/salah, jawaban singkat, esai, menjodohkan, mengurutkan), kunci & pembahasan, materi/topik/kesulitan/tag, duplikasi, impor & ekspor CSV |
| Kuis | Soal dari satu atau banyak materi, urutan & bobot, batas waktu / waktu per soal, acak soal & opsi, batas percobaan, waktu tampil pembahasan, izin tamu, 5 mode, draf/publikasi/arsip, pratinjau admin |
| Live | Kode & tautan sesi, tamu dengan nickname, ruang tunggu, kontrol host, sinkron realtime + polling cadangan, skor berbasis kecepatan, papan peringkat, hasil & CSV, pemulihan koneksi |
| Hasil | Dashboard & riwayat pengguna, detail jawaban + pembahasan, penilaian manual esai, dashboard admin, analitik per kuis & per soal, ekspor CSV |

Kunci jawaban tidak pernah dikirim ke peramban sebelum jawaban dikirim; penilaian berjalan di
fungsi database (`SECURITY DEFINER`) dan semua tabel memakai RLS.

## Menjalankan secara lokal

Butuh Node.js 18.17+ dan proyek Supabase.

```bash
npm ci
cp .env.example .env.local     # isi SUPABASE_SERVICE_ROLE_KEY dan MATERIAL_TOKEN_SECRET
npm run dev                    # http://localhost:3000
```

Pemeriksaan sebelum deploy: `npm run lint`, `npm run typecheck`, `npm run build`.

## Menyiapkan Supabase (sekali)

1. **SQL Editor:** jalankan semua file `supabase/migrations/*.sql` berurutan (aman diulang), atau
   `supabase db push` bila memakai Supabase CLI.
2. **Authentication → Sign In / Providers:** aktifkan *Allow anonymous sign-ins* (tamu kuis).
3. **Authentication → URL Configuration:** isi *Site URL* dengan alamat situs dan tambahkan
   `<alamat situs>/auth/callback` ke *Redirect URLs*.
4. Daftar akun lewat situs, lalu jadikan admin di SQL Editor:
   ```sql
   select public.grant_admin('email@kampus.ac.id');
   ```
5. Impor konten repo (butuh `SUPABASE_SERVICE_ROLE_KEY` di `.env.local`):
   ```bash
   npm run content:import -- --publish
   ```
   Skrip ini membuat/memperbarui mata kuliah dari `content/courses.json`, materi beserta HTML lengkap
   dan pratinjau di bucket privat `materials`, soal dari `window.COURSE` setiap materi (sebagai soal
   pilihan tunggal ber-`source_ref` `<slug>#<nomor>`), serta satu kuis mandiri per materi yang terbuka
   untuk tamu. Aman diulang: data dicocokkan lewat slug dan `source_ref`; kuis yang sudah diubah admin
   tidak ditimpa kecuali dengan `--update-quizzes`. Opsi lain: `--only <slug-materi>`, `--dry-run`.

## Deploy (Netlify)

`netlify.toml` sudah memakai `@netlify/plugin-nextjs`. Atur environment variable di
*Site configuration → Environment variables*:

| Variabel | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publik; nilai bawaan ada di `.env.example` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Rahasia.** Dipakai server untuk membaca bucket privat materi |
| `MATERIAL_TOKEN_SECRET` | **Rahasia**, minimal 32 karakter (`openssl rand -hex 32`). Menandatangani URL pembaca |

Jangan pernah meng-commit `.env.local` atau kunci rahasia.

## Mengelola konten

- **Menambah materi:** simpan file HTML di `content/materials/<slug-mata-kuliah>/`. Mata kuliah baru
  didaftarkan dulu di `content/courses.json`. Lalu jalankan `npm run content:sync` (menyalin mesin
  terbaru ke materi) dan `npm run content:check`.
- **Mengubah mesin materi:** edit `content/engine/kuiskelas.js` / `.css`, naikkan versinya, lalu
  `npm run content:sync`. Jangan mengedit blok mesin di dalam file materi.
- `npm run content:check` memastikan setiap folder terdaftar, mesin mutakhir, `COURSE.id` unik, dan
  setiap soal valid. Setelah konten berubah, jalankan lagi `npm run content:import`.
- Materi juga bisa diunggah manual di **Admin → Materi** (HTML pratinjau, HTML lengkap, dan aset).

Format materi (bagian yang dibaca platform): `<title>`, `<p class="lede">` sebagai deskripsi,
`<section id=… data-toc="…">` sebagai tujuan pembelajaran, dan `window.COURSE = { id, short, title,
questions: [{ q, o: [4 opsi], a: indeks benar, e: pembahasan, topic, hots }] }`.
