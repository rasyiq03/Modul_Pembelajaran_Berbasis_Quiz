import type { QuestionType } from '@/lib/database.types';

/** Soal seperti yang diterima peserta (tanpa kunci) dari start_quiz_attempt / get_session_state */
export type QuestionOption = { key: string; label: string; side: 'left' | 'right' | null };
export type QuestionPayload = {
  id: string;
  type: QuestionType;
  prompt: string;
  media_url: string | null;
  topic: string | null;
  options: QuestionOption[];
  points?: number;
};

/** Jawaban peserta per jenis soal (format sama dengan yang dinilai server) */
export type Response =
  | { selected: string }
  | { selected: string[] }
  | { answer: boolean }
  | { answer: string }
  | { pairs: Record<string, string> }
  | { order: string[] }
  | null;

export type AnswerKey = any;

/** Apakah jawaban sudah cukup lengkap untuk dikirim */
export function isAnswered(q: QuestionPayload, r: Response | undefined): boolean {
  if (!r) return false;
  const v = r as any;
  switch (q.type) {
    case 'single_choice': return typeof v.selected === 'string';
    case 'multiple_select': return Array.isArray(v.selected) && v.selected.length > 0;
    case 'true_false': return typeof v.answer === 'boolean';
    case 'short_answer': case 'essay': return typeof v.answer === 'string' && v.answer.trim() !== '';
    case 'matching': return q.options.filter((o) => o.side === 'left').every((o) => v.pairs?.[o.key]);
    case 'ordering': return Array.isArray(v.order) && v.order.length === q.options.length;
  }
}

/** Jawaban awal: soal mengurutkan dimulai dari urutan yang ditampilkan */
export function initialResponse(q: QuestionPayload): Response | undefined {
  if (q.type === 'ordering') return { order: q.options.map((o) => o.key) };
  return undefined;
}

/** Teks kunci jawaban yang mudah dibaca, untuk hasil & pembahasan */
export function describeAnswer(q: { type: QuestionType; options: QuestionOption[] }, a: AnswerKey): string {
  if (!a) return '';
  const label = (k: string) => q.options.find((o) => o.key === k)?.label ?? k;
  switch (q.type) {
    case 'single_choice': return label(a.answer);
    case 'multiple_select': return (a.answers ?? []).map(label).join('; ');
    case 'true_false': return a.answer ? 'Benar' : 'Salah';
    case 'short_answer': return (a.accepted ?? []).join(' / ');
    case 'essay': return 'Dinilai manual oleh pengajar';
    case 'matching': return Object.entries(a.pairs ?? {}).map(([l, r]) => `${label(l)} → ${label(r as string)}`).join('; ');
    case 'ordering': return (a.order ?? []).map(label).join(' → ');
  }
}

/** Teks jawaban peserta */
export function describeResponse(q: { type: QuestionType; options: QuestionOption[] }, r: any): string {
  if (!r) return 'Tidak dijawab';
  const label = (k: string) => q.options.find((o) => o.key === k)?.label ?? k;
  switch (q.type) {
    case 'single_choice': return label(r.selected);
    case 'multiple_select': return (r.selected ?? []).map(label).join('; ');
    case 'true_false': return r.answer ? 'Benar' : 'Salah';
    case 'short_answer': case 'essay': return r.answer || 'Tidak dijawab';
    case 'matching': return Object.entries(r.pairs ?? {}).map(([l, x]) => `${label(l)} → ${label(x as string)}`).join('; ');
    case 'ordering': return (r.order ?? []).map(label).join(' → ');
  }
}
