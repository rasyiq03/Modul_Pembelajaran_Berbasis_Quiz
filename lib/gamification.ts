/**
 * Aturan gamifikasi yang ditampilkan di web. Perhitungan XP & pemberian lencana terjadi di database
 * (supabase/migrations/20261030000500_gamification.sql); di sini hanya rumus level dan label.
 */

/** XP minimum untuk level n: 0, 100, 300, 600, 1000, 1500, ... */
export const xpForLevel = (n: number) => 50 * (n - 1) * n;

export function levelOf(xp: number) {
  let n = 1;
  while (xp >= xpForLevel(n + 1)) n++;
  return n;
}

export const LEVEL_NAMES = ['Pemula', 'Penjelajah', 'Analis', 'Praktisi', 'Ahli', 'Pakar', 'Master', 'Legenda'];
export const levelName = (n: number) => LEVEL_NAMES[Math.min(n, LEVEL_NAMES.length) - 1];

export function levelProgress(xp: number) {
  const n = levelOf(xp);
  const a = xpForLevel(n);
  const b = xpForLevel(n + 1);
  return { level: n, name: levelName(n), pct: Math.round(((xp - a) / (b - a)) * 100), toNext: b - xp, floor: a, ceil: b };
}

export type BadgeId = 'first' | 'streak5' | 'streak10' | 'perfect' | 'hots' | 'speed' | 'champ' | 'reader' | 'labrat' | 'day3' | 'day7' | 'lv5';

export const BADGES: { id: BadgeId; icon: string; name: string; desc: string }[] = [
  { id: 'first', icon: '🎯', name: 'Langkah pertama', desc: 'Selesaikan satu kuis' },
  { id: 'streak5', icon: '🔥', name: 'Beruntun 5', desc: '5 jawaban benar berturut-turut' },
  { id: 'streak10', icon: '☄️', name: 'Tak terbendung', desc: '10 jawaban benar berturut-turut' },
  { id: 'perfect', icon: '💎', name: 'Sempurna', desc: 'Semua benar dalam kuis minimal 5 soal' },
  { id: 'hots', icon: '🧠', name: 'Pemikir tajam', desc: 'Semua soal sulit (HOTS) benar dalam satu kuis' },
  { id: 'speed', icon: '⚡', name: 'Kilat', desc: 'Kuis live: rata-rata di bawah 5 detik, akurasi minimal 70%' },
  { id: 'champ', icon: '🏆', name: 'Juara kelas', desc: 'Peringkat 1 di kuis live (minimal 3 peserta)' },
  { id: 'reader', icon: '📖', name: 'Pembaca tuntas', desc: 'Tandai semua bab dalam satu materi' },
  { id: 'labrat', icon: '🧪', name: 'Tangan laboratorium', desc: 'Coba semua lab dalam satu materi' },
  { id: 'day3', icon: '📅', name: 'Rajin', desc: 'Belajar 3 hari berturut-turut' },
  { id: 'day7', icon: '🗓️', name: 'Seminggu penuh', desc: 'Belajar 7 hari berturut-turut' },
  { id: 'lv5', icon: '🏅', name: 'Ahli', desc: 'Capai level 5' },
];
export const BADGE: Record<string, (typeof BADGES)[number]> = Object.fromEntries(BADGES.map((b) => [b.id, b]));

export const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐙', '🦉', '🐧', '🦄', '🐝', '🐳', '🦖', '🐱', '🤖', '👾', '🚀', '🌵'] as const;

/** Cara mendapatkan XP, untuk ditampilkan ke pengguna */
export const XP_RULES: [string, string][] = [
  ['Selesaikan kuis', '+20 (sekali per kuis per hari)'],
  ['Soal benar pertama kali', '+10 (berikutnya +2)'],
  ['Semua benar (min. 5 soal)', '+30'],
  ['Ikut kuis live', '+20, podium +50/+30/+20'],
  ['Tandai bab paham di materi', '+20 per bab'],
  ['Coba lab interaktif', '+15 per lab'],
  ['Selesaikan latihan di materi', '+15 (sekali per materi per hari)'],
  ['Hadir hari ini', '+10'],
];

export type XpEvent = { label: string; amount: number; kind: string; created_at: string };
export type MyProgress = {
  xp: number;
  week_xp: number;
  streak: number;
  rank: number;
  badges: { badge: BadgeId; earned_at: string }[];
  recent: XpEvent[];
};

/** Gabungkan event XP berlabel sama (mis. "Soal benar pertama kali" ×7) untuk ringkasan */
export function groupXp(events: { label: string; amount: number }[]) {
  const map = new Map<string, { label: string; amount: number; count: number }>();
  for (const e of events) {
    const g = map.get(e.label) ?? { label: e.label, amount: 0, count: 0 };
    g.amount += e.amount;
    g.count += 1;
    map.set(e.label, g);
  }
  return Array.from(map.values());
}
