# KuisKelas Web (Next.js + Supabase)

Platform catatan kuliah interaktif: katalog mata kuliah & materi, pembaca HTML yang aman, enrollment key per materi, bank soal, kuis mandiri, dan kuis live dengan kode sesi. Basis awalnya dari project Bolt, lalu diperkuat di langkah 1 (fondasi & keamanan) dan diselaraskan tampilannya dengan materi HTML di repo ini.

Satu proyek Supabase dipakai bersama **KuisKelas Online** (`../index.html`). Tabel KuisKelas berawalan `kq_`, sedangkan tabel platform tanpa awalan.

## Menyiapkan Supabase (sekali)

1. **Authentication → Sign In / Providers**: aktifkan *Email* dan *Allow anonymous sign-ins*. Login anonim dipakai tamu kuis dan KuisKelas Online.
2. **Authentication → URL Configuration**: isi *Site URL* dengan alamat situs, lalu tambahkan `https://<situs>/auth/callback` ke *Redirect URLs*.
3. **SQL Editor**: jalankan isi `supabase/migrations/` **berurutan**. Cara lain: `npx supabase db push` bila Supabase CLI sudah ditautkan.
   | File | Isi |
   |---|---|
   | `20261028000100_core.sql` | profil & role, mata kuliah, materi, enrollment key, bucket Storage `materials` |
   | `20261028000200_question_bank_quiz.sql` | bank soal (7 jenis), kuis, percobaan, penilaian server |
   | `20261028000300_live_sessions.sql` | sesi live dengan kode, peserta tamu, skor server |
   | `20261028000400_kuiskelas_online.sql` | salinan persis `../online/schema.sql` (tabel `kq_*`) |

   Semua file aman dijalankan ulang.
4. **Jadikan dirimu admin**: daftar dulu lewat web, lalu jalankan di SQL Editor:
   ```sql
   select public.grant_admin('email-kamu@kampus.ac.id');
   ```
   Fungsi ini sengaja tidak bisa dipanggil dari web. Admin berikutnya bisa diangkat admin lain lewat `set_user_role`.

## Variabel lingkungan

Salin `.env.example` ke `.env.local` untuk pengembangan, dan isi variabel yang sama di Netlify.

| Variabel | Publik? | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya | sudah terisi untuk proyek `pwkpanjngtjnujyuctxl` |
| `SUPABASE_SERVICE_ROLE_KEY` | **rahasia** | dipakai route `/m/...` untuk mengambil isi materi dari bucket privat setelah akses diperiksa |
| `MATERIAL_TOKEN_SECRET` | **rahasia** | minimal 32 karakter, buat dengan `openssl rand -hex 32` |

Tanpa dua variabel rahasia itu situs tetap jalan, tetapi halaman materi dan route `/m` gagal (500) dengan pesan yang menyebut variabel yang kurang di log server.

## Menjalankan

Butuh Node.js 18.17 atau lebih baru.

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run build      # lint dan typecheck ikut dijalankan; build gagal bila ada error
```

Deploy ke Netlify: set *Base directory* = `web`. `netlify.toml` di folder ini sudah memakai `@netlify/plugin-nextjs`. Header keamanan (`X-Frame-Options`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) diatur di `next.config.js`.

## Model keamanan

- **Sesi di cookie** (`@supabase/ssr`): server component, route handler, dan `middleware.ts` mengenali pengguna. Gerbang admin ada di server (`app/admin/layout.tsx`): tamu diarahkan ke `/signin`, non-admin mendapat 404.
- **Data Supabase tidak pernah di-cache Next**: semua klien server memakai `fetch` dengan `cache: 'no-store'`, sehingga pencabutan akses langsung berlaku.
- **Materi HTML tidak ada di tabel publik.** Preview dan materi lengkap disimpan di bucket privat `materials` (`<id>/preview/index.html`, `<id>/full/index.html` + `<id>/full/assets/...`). Halaman materi memeriksa akses di server, lalu memberi iframe URL bertoken berumur 2 jam (`/m/<token>/index.html`).
- **Route `/m` memeriksa ulang** token, status publikasi, dan enrollment di setiap permintaan, menolak path traversal, dan mengirim header `Content-Security-Policy: sandbox ...`. Materi berjalan di origin terisolasi, jadi skripnya tidak bisa membaca cookie atau sesi web, bahkan bila URL-nya dibuka langsung.
- **Kunci jawaban** ada di `question_keys` (hanya admin). Peserta menerima soal tanpa kunci lewat `start_quiz_attempt` / `get_session_state`. Penilaian (`submit_quiz_attempt`, `submit_live_answer`) terjadi di server, dan waktu jawab live dihitung dari jam server.
- **Tidak ada tulis langsung** ke tabel percobaan, sesi, peserta, atau jawaban. Semua lewat fungsi `SECURITY DEFINER` dengan `search_path` tetap.

Konsekuensi isolasi: di dalam pembaca web, XP dan progres baca materi tidak tersimpan, karena origin terisolasi tidak punya `localStorage`. Kuis, lab, dan rangkuman tetap berjalan. Profil XP penuh tetap tersedia saat file materi dibuka langsung atau lewat KuisKelas Online.

## Status MVP

Selesai di langkah 1 (fondasi):
- auth & role di server;
- katalog dan pencarian;
- preview publik & pembaca HTML lengkap yang aman;
- upload HTML & aset (`/admin/materials`);
- tukar enrollment key;
- skema & fungsi server untuk bank soal, kuis mandiri, dan kuis live;
- RLS.

Belum dibuat (langkah 2):
- halaman admin untuk key, bank soal, penyusun kuis, sesi live, dan hasil;
- halaman pengguna `/quizzes`, `/join`, `/dashboard`;
- impor 28 materi & soal dari repo ini (langkah 3).

Navigasi hanya menautkan halaman yang sudah ada. Tambahkan tautan di `components/site/site-header.tsx` dan `components/admin/admin-shell.tsx` begitu halaman langkah 2 selesai. Komponen shadcn/ui yang tidak terpakai sudah dibuang. Tambahkan lagi bila perlu dengan `npx shadcn@latest add <nama>`.
