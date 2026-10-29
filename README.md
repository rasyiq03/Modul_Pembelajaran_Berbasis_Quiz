# KuisKelas: Modul Pembelajaran Berbasis Kuis

Platform web (Next.js + Supabase) untuk materi kuliah interaktif. Setiap materi adalah satu file HTML
mandiri berisi rangkuman, lab interaktif, dan kuis bergaya Kahoot. Platform menambahkan akun dan
admin, katalog, pembaca materi yang aman, enrollment key per materi, bank soal, kuis mandiri,
kuis live dengan kode sesi, serta gamifikasi (XP, level, lencana, hari beruntun, papan peringkat).

File HTML materi tetap bisa dibuka offline (klik dua kali, kirim lewat WhatsApp/LMS). Platform
membaca isi dan soalnya tanpa mengubah file tersebut.

## Struktur

```
.
├── app/                      Next.js App Router (halaman & route handler)
│   ├── (publik)              /, /courses, /materials, /quizzes, /leaderboard, /join, /play/[id], /attempts/[id]
│   ├── dashboard/            dashboard, pencapaian, riwayat kuis, materi saya, profil (pengguna terdaftar)
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
| Gamifikasi | XP & 8 level (Pemula sampai Legenda), 12 lencana, hari beruntun, avatar, halaman Pencapaian, papan peringkat (sepanjang waktu / 7 hari), chip level di header, rincian XP di hasil kuis & kuis live, progres bab & lab per materi |

Kunci jawaban tidak pernah dikirim ke peramban sebelum jawaban dikirim; penilaian berjalan di
fungsi database (`SECURITY DEFINER`) dan semua tabel memakai RLS.

### Gamifikasi

XP dihitung di database (`supabase/migrations/20261030000500_gamification.sql`) dari data yang sudah
dinilai server, sehingga tidak bisa dipalsukan dari peramban. Setiap sumber XP punya kunci unik per
pengguna, jadi tidak ada XP ganda. Hanya pengguna terdaftar yang mengumpulkan XP; tamu diajak membuat akun.

| Aktivitas | XP |
|---|---|
| Menyelesaikan kuis | +20, sekali per kuis per hari |
| Soal benar | +10 pertama kali, +2 bila sudah pernah benar |
| Semua benar (minimal 5 soal) | +30 |
| Ikut kuis live | +20, podium +50/+30/+20 (minimal 3 peserta) |
| Menandai bab paham di materi | +20 per bab |
| Mencoba lab interaktif | +15 per lab |
| Menyelesaikan latihan solo di materi | +15, sekali per materi per hari |
| Hadir hari ini | +10 |

Level n butuh `50 × (n − 1) × n` XP (0, 100, 300, 600, 1000, ...). Materi di pembaca platform
mengirim progres bab/lab ke halaman induk lewat `postMessage`; server hanya menerimanya untuk bab dan
lab yang tercatat di `materials.sections` / `materials.labs` (diisi `npm run content:import`) dan bila
pengguna punya akses materi lengkap. XP aktivitas lama ikut dihitung saat migrasi dijalankan.

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
2. **Authentication → Sign In / Providers:** aktifkan *Allow anonymous sign-ins* (tamu kuis).
3. **Authentication → URL Configuration:** isi *Site URL* dengan domain produksi (mis.
   `https://kuiskelas.vercel.app`) dan tambahkan ke *Redirect URLs*:
   - `https://kuiskelas.vercel.app/auth/callback` (domain produksi, termasuk domain kustom bila ada)
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
   tidak ditimpa kecuali dengan `--update-quizzes`. Opsi lain: `--only <slug-materi>`, `--dry-run`.

## Deploy (Vercel)

Aplikasi ini Next.js standar, jadi Vercel mendeteksinya otomatis; tidak perlu `vercel.json`.

1. **Add New → Project** di dashboard Vercel, lalu impor repo ini dari GitHub. Biarkan
   *Framework Preset* = Next.js dan *Root Directory* = `./` (root repo). Perintah build, instal, dan
   output memakai bawaan.
2. **Settings → Environment Variables:** tambahkan variabel berikut untuk *Production* dan
   *Preview* (juga *Development* bila memakai `vercel env pull`):

   | Variabel | Keterangan |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Publik. URL proyek Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publik. *anon public key*; keamanan data dijaga RLS |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Rahasia** (tandai *Sensitive*). Dipakai server untuk membaca bucket privat materi |
   | `MATERIAL_TOKEN_SECRET` | **Rahasia** (tandai *Sensitive*), minimal 32 karakter. Menandatangani URL pembaca materi |

   Variabel `NEXT_PUBLIC_*` ditanam saat build; setelah mengubahnya, lakukan *Redeploy*.
3. **Settings → Functions → Function Region:** pilih region terdekat dengan region proyek Supabase
   (mis. `sin1` Singapura untuk Supabase `ap-southeast-1`) agar setiap halaman tidak menunggu lama.
4. Deploy. Setiap push ke `main` menjadi deployment produksi, dan setiap branch/PR mendapat
   *preview deployment*. Lalu daftarkan domain produksi di Supabase (langkah 3 bagian sebelumnya).

Menjalankan migrasi database dan `npm run content:import` dilakukan dari komputer lokal atau SQL
Editor, bukan saat build Vercel. Jangan pernah meng-commit `.env.local` atau kunci rahasia.

## Mengelola konten

- **Menambah materi:** simpan file HTML di `content/materials/<slug-mata-kuliah>/`. Mata kuliah baru
  didaftarkan dulu di `content/courses.json`. Lalu jalankan `npm run content:sync` (menyalin mesin
  terbaru ke materi) dan `npm run content:check`.
- **Mengubah mesin materi:** edit `content/engine/kuiskelas.js` / `.css`, naikkan versinya, lalu
  `npm run content:sync`. Jangan mengedit blok mesin di dalam file materi. Sejak v3 mesin tidak lagi
  menyimpan profil, XP, atau lencana; offline ia hanya mencatat progres bab & lab di perangkat, dan di
  pembaca platform progres itu diteruskan ke web. `KQ.award()` tetap ada demi kompatibilitas tetapi
  tidak memberi XP.
- `npm run content:check` memastikan setiap folder terdaftar, mesin mutakhir, `COURSE.id` unik, dan
  setiap soal valid. Setelah konten berubah, jalankan lagi `npm run content:import`.
- Materi juga bisa diunggah manual di **Admin → Materi** (HTML pratinjau, HTML lengkap, dan aset).

Format materi (bagian yang dibaca platform): `<title>`, `<p class="lede">` sebagai deskripsi,
`<section id=… data-toc="…">` di dalam `<article>` sebagai tujuan pembelajaran dan bab yang bisa ditandai
(kecuali `data-nocheck`), elemen `.lab` / `[data-lab]` sebagai lab (kecuali `data-noxp`; id dari
`data-lab`, `id`, atau urutan), dan `window.COURSE = { id, short, title,
questions: [{ q, o: [4 opsi], a: indeks benar, e: pembahasan, topic, hots }] }`.
