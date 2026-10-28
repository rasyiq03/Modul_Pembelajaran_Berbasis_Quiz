/* Konfigurasi KuisKelas Online.
   Isi dua nilai Supabase di bawah agar room kelas, peringkat XP, dan rekap nilai aktif.
   Ambil dari Supabase: Project Settings > API (Project URL dan anon public key).
   Anon key memang publik; keamanan data dijaga Row Level Security di online/schema.sql.
   Proyek ini dipakai bersama platform web/ (tabel KuisKelas berawalan kq_).
   Kosongkan bila hanya ingin memakai katalog materi (latihan solo tetap jalan). */
window.KQ_ONLINE = {
  supabaseUrl: 'https://pwkpanjngtjnujyuctxl.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3a3BhbmpuZ3RqbnVqeXVjdHhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNTIzNzEsImV4cCI6MjEwNTYyODM3MX0.eOdnCmTSMj1kKbrRJ6lk_uMMVxieXHqbMa-iwdmxews',
  defaultClass: ''        // opsional: kode kelas bawaan, misalnya 'TI-2A'
};
