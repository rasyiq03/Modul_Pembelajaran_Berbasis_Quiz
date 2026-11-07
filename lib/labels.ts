import type { AccessLevel, QuestionType, QuizMode, Status } from '@/lib/database.types';

export const STATUS_LABEL: Record<Status, string> = { draft: 'Draf', published: 'Terpublikasi', archived: 'Diarsipkan' };

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  single_choice: 'Pilihan tunggal',
  multiple_select: 'Pilihan ganda jamak',
  true_false: 'Benar/salah',
  short_answer: 'Jawaban singkat',
  essay: 'Esai',
  matching: 'Menjodohkan',
  ordering: 'Mengurutkan',
};
export const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABEL) as QuestionType[];

export const QUIZ_MODE_LABEL: Record<QuizMode, string> = {
  self_paced: 'Kuis mandiri',
  interactive_practice: 'Latihan interaktif',
  live_competition: 'Kompetisi live',
  timed_assessment: 'Ujian berbatas waktu',
  self_paced_assessment: 'Ujian mandiri',
};
export const QUIZ_MODE_HELP: Record<QuizMode, string> = {
  self_paced: 'Dikerjakan kapan saja; hasil dan pembahasan setelah dikirim.',
  interactive_practice: 'Umpan balik langsung setelah setiap soal.',
  live_competition: 'Hanya lewat sesi live dengan kode yang dipandu host.',
  timed_assessment: 'Batas waktu untuk seluruh kuis; dikirim otomatis saat waktu habis.',
  self_paced_assessment: 'Satu kali percobaan, dikerjakan mandiri.',
};
export const QUIZ_MODES = Object.keys(QUIZ_MODE_LABEL) as QuizMode[];

export const FEEDBACK_LABEL = {
  after_each: 'Setelah setiap soal',
  after_submit: 'Setelah kuis dikirim',
  never: 'Tidak ditampilkan',
} as const;
export type Feedback = keyof typeof FEEDBACK_LABEL;

export const DIFFICULTY_LABEL = { easy: 'Mudah', medium: 'Sedang', hard: 'Sulit' } as const;

export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = { public: 'Terbuka', member: 'Wajib masuk', subscriber: 'Langganan' };
export const ACCESS_LEVEL_HELP: Record<AccessLevel, string> = {
  public: 'Semua orang, termasuk tamu tanpa akun, membaca materi lengkap.',
  member: 'Materi lengkap terbuka untuk semua pengguna yang masuk dengan akun.',
  subscriber: 'Materi lengkap hanya untuk pelanggan aktif; yang lain melihat pratinjau.',
};
export const ACCESS_LEVELS = Object.keys(ACCESS_LEVEL_LABEL) as AccessLevel[];

export const SUBSCRIPTION_STATUS_LABEL = {
  pending: 'Menunggu persetujuan',
  active: 'Aktif',
  expired: 'Kedaluwarsa',
  rejected: 'Ditolak',
  revoked: 'Dicabut',
  cancelled: 'Dibatalkan',
} as const;

/** Galat dari fungsi database (RAISE 'KODE: pesan') → kalimat untuk pengguna */
const ERRORS: Record<string, string> = {
  AUTH_REQUIRED: 'Sesi login belum siap. Muat ulang halaman lalu coba lagi.',
  LOGIN_REQUIRED: 'Kuis ini hanya untuk pengguna terdaftar. Silakan masuk dulu.',
  QUIZ_NOT_FOUND: 'Kuis tidak ditemukan atau belum dipublikasikan.',
  QUIZ_EMPTY: 'Kuis ini belum punya soal.',
  LIVE_ONLY: 'Kuis ini hanya bisa diikuti lewat sesi live dengan kode dari pengajar.',
  ATTEMPTS_EXHAUSTED: 'Jatah percobaan untuk kuis ini sudah habis.',
  ALREADY_SUBMITTED: 'Percobaan ini sudah dikirim.',
  ATTEMPT_NOT_FOUND: 'Percobaan tidak ditemukan.',
  NOT_SUBMITTED: 'Percobaan ini belum dikirim.',
  FEEDBACK_DISABLED: 'Umpan balik per soal tidak aktif untuk kuis ini.',
  SESSION_NOT_FOUND: 'Kode sesi tidak ditemukan. Periksa lagi kode di layar pengajar.',
  SESSION_CLOSED: 'Sesi ini sudah selesai.',
  SESSION_FULL: 'Sesi ini sudah penuh.',
  NICKNAME_TAKEN: 'Nama itu sudah dipakai peserta lain. Pilih nama lain.',
  NICKNAME_REQUIRED: 'Isi nama tampilan terlebih dahulu.',
  NOT_JOINED: 'Kamu belum bergabung ke sesi ini.',
  NOT_ACCEPTING: 'Soal ini sedang tidak menerima jawaban.',
  TIME_UP: 'Waktu menjawab sudah habis.',
  ALREADY_ANSWERED: 'Jawabanmu untuk soal ini sudah terkirim.',
  NOT_HOST: 'Hanya host sesi yang bisa melakukan ini.',
  ALREADY_STARTED: 'Sesi sudah dimulai.',
  ADMIN_ONLY: 'Hanya admin yang bisa melakukan ini.',
  CANNOT_DEMOTE_SELF: 'Kamu tidak bisa mencabut peran admin dari akunmu sendiri.',
  MATERIAL_NOT_FOUND: 'Materi tidak ditemukan.',
  SUBSCRIPTION_REQUIRED: 'Kuis ini khusus pelanggan. Ajukan langganan untuk mengerjakannya.',
  COURSE_NOT_FOUND: 'Mata kuliah tidak ditemukan atau belum dipublikasikan.',
  ARENA_EMPTY: 'Belum ada soal pilihan ganda atau benar/salah yang bisa dimainkan di Arena.',
  ARENA_NOT_FOUND: 'Permainan Arena tidak ditemukan.',
  ARENA_FINISHED: 'Permainan ini sudah selesai.',
  FRIEND_CODE_NOT_FOUND: 'Kode teman tidak ditemukan. Periksa lagi kodenya.',
  FRIEND_SELF: 'Itu kode temanmu sendiri.',
  ALREADY_FRIENDS: 'Kalian sudah berteman.',
  REQUEST_PENDING: 'Permintaan pertemanan sudah dikirim dan menunggu jawaban.',
  TOO_MANY_REQUESTS: 'Terlalu banyak permintaan yang belum dijawab. Batalkan sebagian dulu.',
  FRIEND_REQUEST_NOT_FOUND: 'Permintaan pertemanan tidak ditemukan.',
};

export function errorMessage(e: unknown): string {
  const raw = String((e as { message?: string })?.message ?? e ?? '');
  const m = raw.match(/^(BAD_[A-Z]+):\s*(.*)$/);
  if (m) return m[2];
  for (const k in ERRORS) if (raw.includes(k)) return ERRORS[k];
  if (/anonymous/i.test(raw)) return 'Login tamu belum diaktifkan di Supabase (Authentication → Anonymous sign-ins).';
  if (/fetch|network/i.test(raw)) return 'Tidak bisa menghubungi server. Periksa koneksi internet.';
  return raw || 'Terjadi galat.';
}

export const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '–';
export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '–');
export const fmtNum = (n: number | null | undefined, d = 1) => Number(n ?? 0).toLocaleString('id-ID', { maximumFractionDigits: d });

/* Pesan galat Supabase Auth yang umum, dalam Bahasa Indonesia */
export function authError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email atau kata sandi salah.';
  if (/email not confirmed/i.test(message)) return 'Email belum dikonfirmasi. Buka tautan konfirmasi di kotak masukmu.';
  if (/already registered|already been registered/i.test(message)) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (/password should be|weak password/i.test(message)) return 'Kata sandi terlalu lemah (minimal 6 karakter).';
  if (/rate limit|too many/i.test(message)) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  if (/invalid.*email|unable to validate email/i.test(message)) return 'Format email tidak valid.';
  return message;
}
