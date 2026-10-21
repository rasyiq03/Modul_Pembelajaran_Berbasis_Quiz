/* Konfigurasi KuisKelas Online.
   Isi dua nilai Supabase di bawah agar room kelas, peringkat XP, dan rekap nilai aktif.
   Ambil dari Supabase: Project Settings > API (Project URL dan anon public key).
   Anon key memang publik; keamanan data dijaga Row Level Security di online/schema.sql.
   Biarkan kosong bila hanya ingin memakai katalog materi (latihan solo tetap jalan). */
window.KQ_ONLINE = {
  supabaseUrl: '',        // contoh: 'https://abcdefgh.supabase.co'
  supabaseAnonKey: '',    // contoh: 'eyJhbGciOi...'
  defaultClass: ''        // opsional: kode kelas bawaan, misalnya 'TI-2A'
};
