/**
 * Format CSV bank soal (FR-34/35). File ekspor bisa langsung diimpor ulang.
 *
 * Kolom: source_ref, type, prompt, options, answer, explanation, topic, difficulty, status, materials, tags, media_url
 *   options   "A: teks | B: teks". Menjodohkan: kunci kiri berawalan L, kanan berawalan R ("L1: Mean | R1: low-pass").
 *   answer    single_choice "B" · multiple_select "A, C" · true_false "benar"/"salah" ·
 *             short_answer "translasi | translation" · ordering "C, A, B" · matching "L1=R2, L2=R1" · essay kosong
 *   materials "<slug-mata-kuliah>/<slug-materi>" dipisah koma · tags dipisah koma
 *   source_ref  pengenal unik opsional; baris dengan source_ref yang sama memperbarui soal lama
 */
import type { QuestionType } from '@/lib/database.types';
import { QUESTION_TYPES } from '@/lib/labels';

export const CSV_COLUMNS = ['source_ref', 'type', 'prompt', 'options', 'answer', 'explanation', 'topic', 'difficulty', 'status', 'materials', 'tags', 'media_url'] as const;

type Opt = { key: string; label: string; side: 'left' | 'right' | null };
const list = (s: string, sep = ',') => s.split(sep).map((x) => x.trim()).filter(Boolean);

export function questionToRow(q: {
  source_ref: string | null; type: QuestionType; prompt: string; media_url: string | null; topic: string | null;
  difficulty: string | null; status: string; options: Opt[]; answer: any; explanation: string | null;
  materials: string[]; tags: string[];
}): string[] {
  const a = q.answer ?? {};
  const answer = {
    single_choice: () => a.answer ?? '',
    multiple_select: () => (a.answers ?? []).join(', '),
    true_false: () => (a.answer ? 'benar' : 'salah'),
    short_answer: () => (a.accepted ?? []).join(' | '),
    essay: () => '',
    matching: () => Object.entries(a.pairs ?? {}).map(([l, r]) => `${l}=${r}`).join(', '),
    ordering: () => (a.order ?? []).join(', '),
  }[q.type]();
  return [
    q.source_ref ?? '', q.type, q.prompt,
    q.options.map((o) => `${o.key}: ${o.label}`).join(' | '),
    answer, q.explanation ?? '', q.topic ?? '', q.difficulty ?? '', q.status,
    q.materials.join(', '), q.tags.join(', '), q.media_url ?? '',
  ];
}

/** Baris CSV → payload admin_save_question. materialIds memetakan "mata-kuliah/materi" → uuid. */
export function rowToQuestion(r: Record<string, string>, materialIds: Map<string, string>) {
  const type = (r.type || '').trim() as QuestionType;
  if (!QUESTION_TYPES.includes(type)) throw new Error(`jenis soal "${r.type}" tidak dikenal`);
  const options: Opt[] = list(r.options || '', '|').map((part) => {
    const i = part.indexOf(':');
    const key = (i < 0 ? '' : part.slice(0, i)).trim();
    const label = (i < 0 ? part : part.slice(i + 1)).trim();
    if (!key) throw new Error(`opsi "${part}" harus berbentuk "KUNCI: teks"`);
    return { key, label, side: type === 'matching' ? (/^l/i.test(key) ? 'left' : 'right') : null };
  });
  const ans = (r.answer || '').trim();
  const answer = {
    single_choice: () => ({ answer: ans }),
    multiple_select: () => ({ answers: list(ans) }),
    true_false: () => {
      if (!/^(benar|salah|true|false|b|s|ya|tidak)$/i.test(ans)) throw new Error('jawaban benar/salah harus "benar" atau "salah"');
      return { answer: /^(benar|true|b|ya)$/i.test(ans) };
    },
    short_answer: () => ({ accepted: list(ans, '|') }),
    essay: () => ({}),
    matching: () => ({ pairs: Object.fromEntries(list(ans).map((p) => p.split('=').map((x) => x.trim()))) }),
    ordering: () => ({ order: list(ans) }),
  }[type]();
  const material_ids = list(r.materials || '').map((m) => {
    const id = materialIds.get(m.toLowerCase());
    if (!id) throw new Error(`materi "${m}" tidak ditemukan (pakai format mata-kuliah/materi)`);
    return id;
  });
  return {
    source_ref: r.source_ref || null, type, prompt: r.prompt || '', options, answer,
    explanation: r.explanation || null, topic: r.topic || null, difficulty: r.difficulty || null,
    status: r.status || 'draft', material_ids, tags: list(r.tags || ''), media_url: r.media_url || null,
  };
}
