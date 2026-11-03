# Cognify: Catatan Kuliah Interaktif Berbasis Kuis

Platform web (Next.js + Supabase) untuk materi kuliah interaktif. Setiap materi adalah satu file HTML
mandiri berisi rangkuman, lab interaktif, dan kuis bergaya Kahoot. Platform menambahkan akun dan
admin, katalog, pembaca materi layar penuh yang aman, langganan dengan tingkat akses per materi, bank soal, kuis mandiri, dan
kuis live dengan kode sesi.

File HTML materi tetap bisa dibuka offline (klik dua kali, kirim lewat WhatsApp/LMS). Platform
membaca isi dan soalnya tanpa mengubah file tersebut.

## Struktur

```
.
├── app/                      Next.js App Router (halaman & route handler)
│   ├── (site)/               halaman berheader & footer situs:
│   │   ├── …                 /, /courses, /courses/[slug], /materials, /quizzes, /join, /play/[id], /attempts/[id]
│   │   ├── dashboard/        ringkasan, langganan, riwayat kuis, profil (pengguna terdaftar)
│   │   └── admin/            ringkasan, mata kuliah, materi, langganan, bank soal, kuis, sesi live,
│   │                         hasil & analitik, pengguna (khusus admin)
│   ├── (reader)/             /courses/[slug]/[material]: pembaca materi layar penuh (tanpa header situs)
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
| Materi | Katalog & pencarian, pembaca layar penuh ter-sandbox (lab & kuis tertanam tetap jalan) dengan navigasi antarmateri, panel info/kuis, dan mode layar penuh; pratinjau otomatis; unggah HTML + aset; status draf/terpublikasi/diarsipkan |
| Tingkat akses | Per materi: **Terbuka** (semua orang, termasuk tamu), **Wajib masuk** (pengguna terdaftar), **Langganan** (pelanggan aktif, bawaan). Diubah admin langsung dari daftar materi. Yang belum berhak melihat pratinjau |
| Langganan | Pengguna mengajukan langganan (dengan pesan); admin menyetujui dengan masa berlaku (tanpa batas, 1/6/12 bulan, atau tanggal tertentu), menolak dengan alasan, memperpanjang, atau mencabut; perpanjangan diajukan ulang oleh pengguna; lencana jumlah pengajuan di menu admin |
| Bank soal | 7 jenis (pilihan tunggal, pilihan jamak, benar/salah, jawaban singkat, esai, menjodohkan, mengurutkan), kunci & pembahasan, materi/topik/kesulitan/tag, duplikasi, impor & ekspor CSV |
| Kuis | Soal dari satu atau banyak materi, urutan & bobot, batas waktu / waktu per soal, acak soal & opsi, batas percobaan, waktu tampil pembahasan, izin tamu, 5 mode, draf/publikasi/arsip, pratinjau admin |
| Live | Kode & tautan sesi, tamu dengan nickname, ruang tunggu, kontrol host, sinkron realtime + polling cadangan, skor berbasis kecepatan, papan peringkat, hasil & CSV, pemulihan koneksi |
| Hasil | Dashboard & riwayat pengguna, detail jawaban + pembahasan, penilaian manual esai, dashboard admin, analitik per kuis & per soal, ekspor CSV |

Kunci jawaban tidak pernah dikirim ke peramban sebelum jawaban dikirim; penilaian berjalan di
fungsi database (`SECURITY DEFINER`) dan semua tabel memakai RLS.

## Menjalankan secara lokal

Butuh Node.js 20+ dan proyek Supabase. Buat file `.env.local` di root (sudah diabaikan git):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>      # rahasia
MATERIAL_TOKEN_SECRET=<openssl rand -hex 32>      # rahasia, minimal 32 karakter
```

Nilai Supabase ada di *Project Settings → API*. Bila proyek sudah ditautkan ke Vercel, isi berkas ini
bisa diambil dengan `vercel env pull .env.local`.

```bash
npm ci
npm run dev                    # http://localhost:3000
```

Pemeriksaan sebelum deploy: `npm run lint`, `npm run typecheck`, `npm run build`.

## Menyiapkan Supabase (sekali)

1. **SQL Editor:** jalankan semua file `supabase/migrations/*.sql` berurutan (aman diulang), atau
   `supabase db push` bila memakai Supabase CLI.

   **Memperbarui proyek yang sudah berjalan ke langganan:** cukup jalankan
   `20261030000500_subscriptions.sql`. Migrasi ini menambah tingkat akses per materi (semua materi
   lama menjadi *Langganan*), membuat tabel `subscriptions`, mengubah pemegang enrollment aktif menjadi
   pengajuan langganan yang menunggu persetujuan, lalu **menghapus** tabel & fungsi enrollment key.
   Setelah itu jalankan `npm run content:import` agar semua pratinjau dibuat ulang dengan format baru.
2. **Authentication → Sign In / Providers:** aktifkan *Allow anonymous sign-ins* (tamu kuis).
3. **Authentication → URL Configuration:** isi *Site URL* dengan domain produksi (mis.
   `https://cognify-id.vercel.app`) dan tambahkan ke *Redirect URLs*:
   - `https://cognify-id.vercel.app/auth/callback` (domain produksi, termasuk domain kustom bila ada)
   - `https://*-<slug-tim-vercel>.vercel.app/**` agar konfirmasi email juga jalan di *preview deployment*
   - `http://localhost:3000/**` untuk pengembangan lokal
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
   tidak ditimpa kecuali dengan `--update-quizzes`. Opsi lain: `--only <slug-materi>`, `--dry-run`,
   `--access public|member|subscriber` (menyetel tingkat akses materi yang diimpor; tanpa opsi ini
   tingkat akses yang diatur admin tidak diubah).

   Pratinjau dibuat otomatis (`lib/materials/preview.mjs`): dokumen materi asli dengan mesin tetap aktif,
   bagian pertama terbuka, bagian lain terkunci (judulnya tetap di daftar isi), dan 5 soal contoh. Isi
   bagian terkunci dan soal lainnya tidak ikut terkirim.

## Deploy (Vercel)

Produksi: proyek Vercel `kuiskelas` (https://cognify-id.vercel.app; domain lama `kuiskelas.vercel.app` dialihkan 308 ke sana), di-deploy lewat **Vercel CLI**
dari komputer lokal, bukan dari integrasi GitHub. Vercel membangun ulang di servernya; `.vercelignore`
mencegah `.env.local` dan hasil build lokal ikut terunggah.

```bash
npx vercel login                                   # sekali per komputer
npx vercel link --yes --project kuiskelas          # sekali per folder (membuat .vercel/)
npx vercel deploy --prod                           # setiap rilis
```

`vercel.json` mengunci region functions ke `sin1` (Singapura), sama dengan region Supabase. Tanpanya
functions berjalan di AS dan setiap halaman menunggu 1–3 detik karena query bolak-balik ke Singapura.

Untuk proyek Vercel baru:

1. Jalankan `vercel link` di atas (tanpa `--project` untuk membuat proyek baru). *Framework Preset*
   = Next.js dan *Root Directory* = `./`; perintah build, instal, dan output memakai bawaan.
2. **Settings → Environment Variables:** tambahkan variabel berikut untuk *Production* dan
   *Preview* (juga *Development* bila memakai `vercel env pull`):

   | Variabel | Keterangan |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Publik. URL proyek Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publik. *anon public key*; keamanan data dijaga RLS |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Rahasia** (tandai *Sensitive*). Dipakai server untuk membaca bucket privat materi |
   | `MATERIAL_TOKEN_SECRET` | **Rahasia** (tandai *Sensitive*), minimal 32 karakter. Menandatangani URL pembaca materi |

   Variabel `NEXT_PUBLIC_*` ditanam saat build; setelah mengubahnya, lakukan *Redeploy*.
3. Bila proyek Supabase bukan di Singapura, ganti `regions` di `vercel.json` ke region Vercel
   terdekat dengannya.
4. `npx vercel deploy --prod`, lalu daftarkan domain produksi di Supabase (langkah 3 bagian sebelumnya).

Menjalankan migrasi database dan `npm run content:import` dilakukan dari komputer lokal atau SQL
Editor, bukan saat build Vercel. Jangan pernah meng-commit `.env.local` atau kunci rahasia.

## Mengelola konten

- **Menambah materi:** simpan file HTML di `content/materials/<slug-mata-kuliah>/`. Mata kuliah baru
  didaftarkan dulu di `content/courses.json`. Lalu jalankan `npm run content:sync` (menyalin mesin
  terbaru ke materi) dan `npm run content:check`.
- **Mengubah mesin materi:** edit `content/engine/kuiskelas.js` / `.css`, naikkan versinya, lalu
  `npm run content:sync`. Jangan mengedit blok mesin di dalam file materi.
- `npm run content:check` memastikan setiap folder terdaftar, mesin mutakhir, `COURSE.id` unik, dan
  setiap soal valid. Setelah konten berubah, jalankan lagi `npm run content:import`.
- Materi juga bisa diunggah manual di **Admin → Materi** (HTML lengkap, aset, dan opsional HTML pratinjau;
  bila pratinjau dikosongkan, dibuat otomatis dari HTML lengkap).

Format materi (bagian yang dibaca platform): `<title>`, `<p class="lede">` sebagai deskripsi,
`<section id=… data-toc="…">` sebagai tujuan pembelajaran, dan `window.COURSE = { id, short, title,
questions: [{ q, o: [4 opsi], a: indeks benar, e: pembahasan, topic, hots }] }`.
