import type { QuestionType } from '@/lib/database.types';
import { QuestionRegistry } from '@/lib/dsl/assessment/registry';
import type { QuestionOption, QuestionPayload, ResponsePayload, AnswerKeyPayload } from '@/lib/dsl/assessment/types';

export type { QuestionOption, QuestionPayload };
export type Response = ResponsePayload;
export type AnswerKey = AnswerKeyPayload;

/** Apakah jawaban sudah cukup lengkap untuk dikirim */
export function isAnswered(q: QuestionPayload, r: Response | undefined): boolean {
  return QuestionRegistry.isAnswered(q, r);
}

/** Jawaban awal: soal mengurutkan dimulai dari urutan yang ditampilkan */
export function initialResponse(q: QuestionPayload): Response | undefined {
  return QuestionRegistry.initialResponse(q);
}

/** Teks kunci jawaban yang mudah dibaca, untuk hasil & pembahasan */
export function describeAnswer(q: { type: QuestionType; options: QuestionOption[] }, a: AnswerKey): string {
  return QuestionRegistry.describeAnswer(q, a);
}

/** Teks jawaban peserta */
export function describeResponse(q: { type: QuestionType; options: QuestionOption[] }, r: any): string {
  return QuestionRegistry.describeResponse(q, r);
}
