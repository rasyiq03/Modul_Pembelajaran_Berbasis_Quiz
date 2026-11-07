import type { QuestionPayload, Response } from '@/lib/quiz/types';

/*
  Arena: kuis gaya Kahoot melawan bot. Skor pemain dihitung server (arena_answer); bot disimulasikan
  di sini dengan rumus yang sama dengan mesin materi (content/engine/kuiskelas.js, mode solo).
*/

export type ArenaChoice = { label: string; response: Response };
export type BotLevel = 'easy' | 'normal' | 'hard';
export type Bot = { name: string; skill: number; speed: number; score: number; prev: number; streak: number };
export type Player = { name: string; score: number; prev: number; me: boolean };

export const BOT_LEVELS: Record<BotLevel, { label: string; help: string; skill: [number, number]; speed: [number, number] }> = {
  easy: { label: 'Santai', help: 'Bot sering salah dan lambat.', skill: [0.25, 0.55], speed: [0.35, 0.8] },
  normal: { label: 'Seimbang', help: 'Seperti teman sekelas: ada yang jago, ada yang belum.', skill: [0.4, 0.9], speed: [0.12, 0.62] },
  hard: { label: 'Jago', help: 'Bot hampir selalu benar dan cepat.', skill: [0.75, 0.97], speed: [0.06, 0.35] },
};

const BOT_NAMES = ['Ayu', 'Bima88', 'Nora', 'Rafi_R', 'Sinta', 'Dimas', 'Lena', 'Citra', 'Fajar404', 'Wulan', 'Gilang', 'Putri.K', 'Bayu_B', 'Rina', 'Kevin', 'Salsa', 'Yoga', 'Tiara'];
export const BOT_COUNT = 7;

/** Pilihan jawaban sesuai urutan tampilan; benar/salah tidak punya opsi tersimpan */
export function choicesOf(q: QuestionPayload): ArenaChoice[] {
  if (q.type === 'true_false') return [{ label: 'Benar', response: { answer: true } }, { label: 'Salah', response: { answer: false } }];
  return q.options.map((o) => ({ label: o.label, response: { selected: o.key } }));
}

/** Indeks pilihan yang benar menurut kunci dari server */
export function correctIndex(q: QuestionPayload, key: any): number {
  if (!key) return -1;
  if (q.type === 'true_false') return key.answer === true ? 0 : key.answer === false ? 1 : -1;
  return q.options.findIndex((o) => o.key === key.answer);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const points = (dtSec: number, T: number, hots: boolean) => Math.round((1 - dtSec / T / 2) * 1000) * (hots ? 2 : 1);
export const streakBonus = (s: number) => (s > 1 ? Math.min(s - 1, 5) * 100 : 0);

export function makeBots(level: BotLevel, n = BOT_COUNT): Bot[] {
  const L = BOT_LEVELS[level];
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, n);
  return names.map((name) => ({ name, skill: rand(...L.skill), speed: rand(...L.speed), score: 0, prev: 0, streak: 0 }));
}

/**
 * Jalankan satu soal untuk semua bot. Mengembalikan bot baru dan pilihan masing-masing (untuk grafik
 * sebaran jawaban). Soal HOTS lebih sulit bagi bot, sama dengan mesin materi.
 */
export function playBots(bots: Bot[], correct: number, nChoices: number, T: number, hots: boolean): { bots: Bot[]; picks: number[] } {
  const picks: number[] = [];
  const next = bots.map((b) => {
    const right = correct >= 0 && Math.random() < b.skill * (hots ? 0.75 : 1);
    const rt = Math.min(0.97, Math.max(0.06, b.speed + (Math.random() - 0.5) * 0.4)) * T;
    if (right) {
      picks.push(correct);
      const streak = b.streak + 1;
      return { ...b, prev: b.score, score: b.score + points(rt, T, hots) + streakBonus(streak), streak };
    }
    const wrong = Array.from({ length: nChoices }, (_, i) => i).filter((i) => i !== correct);
    picks.push(wrong.length ? wrong[Math.floor(Math.random() * wrong.length)] : -1);
    return { ...b, prev: b.score, streak: 0 };
  });
  return { bots: next, picks };
}

/** Peringkat; seri dimenangkan pemain */
export function ranking(bots: Bot[], me: { name: string; score: number; prev: number }): Player[] {
  return [...bots.map((b) => ({ name: b.name, score: b.score, prev: b.prev, me: false })), { ...me, me: true }]
    .sort((a, b) => b.score - a.score || (a.me ? -1 : b.me ? 1 : 0));
}

export const fmtPts = (n: number) => n.toLocaleString('id-ID');
