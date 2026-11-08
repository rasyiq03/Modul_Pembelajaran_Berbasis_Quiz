import type { QuestionType } from '@/lib/database.types';

export interface QuestionOption {
  key: string;
  label: string;
  side: 'left' | 'right' | null;
}

export interface QuestionPayload {
  id: string;
  type: QuestionType;
  prompt: string;
  media_url: string | null;
  topic: string | null;
  options: QuestionOption[];
  points?: number;
}

export type ResponsePayload =
  | { selected: string }
  | { selected: string[] }
  | { answer: boolean }
  | { answer: string }
  | { pairs: Record<string, string> }
  | { order: string[] }
  | null;

export type AnswerKeyPayload = any;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface QuestionTypeHandler<TAnswer = any, TResponse = any> {
  readonly type: QuestionType;
  readonly label: string;

  /** Memeriksa apakah jawaban yang diberikan oleh peserta sudah lengkap untuk dikirim */
  isAnswered(response: TResponse | undefined, options: QuestionOption[]): boolean;

  /** Memberikan nilai awal respon (misal urutan awal untuk soal mengurutkan) */
  initialResponse(options: QuestionOption[]): TResponse | undefined;

  /** Representasi teks kunci jawaban yang ramah dibaca manusia */
  describeAnswer(answer: TAnswer, options: QuestionOption[]): string;

  /** Representasi teks respon peserta yang ramah dibaca manusia */
  describeResponse(response: TResponse | undefined, options: QuestionOption[]): string;

  /** Evaluasi lokal / instan (opsional untuk latihan interaktif) */
  gradeLocally?(response: TResponse, answer: TAnswer, options: QuestionOption[]): boolean | null;

  /** Validasi kelayakan opsi dan kunci */
  validate?(options: QuestionOption[], answer: TAnswer): ValidationResult;
}
