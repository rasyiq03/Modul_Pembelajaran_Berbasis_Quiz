import type { AccessLevel, QuestionType, QuizMode, Status } from '@/lib/database.types';
import type { Feedback } from '@/lib/labels';
import type { QuestionOption, ValidationResult } from './types';
import { QuestionRegistry } from './registry';
import { mixQuestionsAcrossMaterials } from '../access/policy';

export interface QuizSettings {
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  time_limit_sec?: number | null;
  question_time_sec?: number;
  attempts_allowed?: number | null;
  show_feedback?: Feedback;
  allow_guests?: boolean;
  pass_threshold?: number;
  show_leaderboard?: boolean;
}

export interface QuizQuestionItem {
  question_id: string;
  points: number;
}

export interface QuizPayload {
  id?: string;
  title: string;
  description: string | null;
  mode: QuizMode;
  status: Status;
  access_level: AccessLevel | null;
  settings: QuizSettings;
  questions: QuizQuestionItem[];
}

export class QuizBuilder {
  private payload: QuizPayload;

  constructor(title: string) {
    this.payload = {
      title,
      description: null,
      mode: 'self_paced',
      status: 'draft',
      access_level: null,
      settings: {
        shuffle_questions: false,
        shuffle_options: false,
        show_feedback: 'after_submit',
        allow_guests: false,
        pass_threshold: 60,
        show_leaderboard: true,
      },
      questions: [],
    };
  }

  id(id: string): this {
    this.payload.id = id;
    return this;
  }

  description(desc: string | null): this {
    this.payload.description = desc;
    return this;
  }

  mode(m: QuizMode): this {
    this.payload.mode = m;
    if (m === 'interactive_practice') {
      this.payload.settings.show_feedback = 'after_each';
    } else if (m === 'self_paced_assessment') {
      this.payload.settings.attempts_allowed = 1;
    }
    return this;
  }

  status(s: Status): this {
    this.payload.status = s;
    return this;
  }

  accessLevel(level: AccessLevel | null): this {
    this.payload.access_level = level;
    return this;
  }

  timeLimitSec(seconds: number | null): this {
    this.payload.settings.time_limit_sec = seconds;
    return this;
  }

  questionTimeSec(seconds: number): this {
    this.payload.settings.question_time_sec = seconds;
    return this;
  }

  attemptsAllowed(attempts: number | null): this {
    this.payload.settings.attempts_allowed = attempts;
    return this;
  }

  showFeedback(fb: Feedback): this {
    this.payload.settings.show_feedback = fb;
    return this;
  }

  allowGuests(allow = true): this {
    this.payload.settings.allow_guests = allow;
    return this;
  }

  passThreshold(threshold: number): this {
    this.payload.settings.pass_threshold = threshold;
    return this;
  }

  shuffle(questions = true, options = true): this {
    this.payload.settings.shuffle_questions = questions;
    this.payload.settings.shuffle_options = options;
    return this;
  }

  addQuestion(questionId: string, points = 1): this {
    this.payload.questions.push({ question_id: questionId, points });
    return this;
  }

  addQuestions(questionIds: string[], defaultPoints = 1): this {
    questionIds.forEach((id) => this.addQuestion(id, defaultPoints));
    return this;
  }

  /**
   * Mencampur soal dari beberapa materi sekaligus secara proporsional.
   */
  mixFromMaterials<T extends { id: string; material_ids: string[] }>(
    bankQuestions: T[],
    materialIds: string[],
    perMaterialCount = 5,
    defaultPoints = 1,
  ): this {
    const existing = new Set(this.payload.questions.map((q) => q.question_id));
    const available = bankQuestions.filter((q) => !existing.has(q.id));
    const { pickedIds } = mixQuestionsAcrossMaterials(available, materialIds, perMaterialCount);
    return this.addQuestions(pickedIds, defaultPoints);
  }

  validate(): ValidationResult {
    const errors: string[] = [];
    if (!this.payload.title || this.payload.title.trim() === '') {
      errors.push('Judul kuis tidak boleh kosong.');
    }
    if (this.payload.mode === 'timed_assessment' && !this.payload.settings.time_limit_sec) {
      errors.push('Ujian berbatas waktu membutuhkan batas waktu.');
    }
    if (this.payload.status === 'published' && this.payload.questions.length === 0) {
      errors.push('Kuis tanpa soal tidak dapat dipublikasikan.');
    }
    return { valid: errors.length === 0, errors };
  }

  build(): QuizPayload {
    const v = this.validate();
    if (!v.valid) {
      throw new Error(`Invalid Quiz: ${v.errors.join('; ')}`);
    }
    return this.payload;
  }
}

export class QuestionBuilder {
  private _type: QuestionType;
  private _prompt: string;
  private _options: QuestionOption[] = [];
  private _answer: any = {};
  private _explanation: string | null = null;
  private _difficulty: 'easy' | 'medium' | 'hard' | null = null;
  private _topic: string | null = null;
  private _status: Status = 'draft';
  private _materialIds: string[] = [];
  private _tags: string[] = [];
  private _mediaUrl: string | null = null;

  constructor(type: QuestionType, prompt: string) {
    this._type = type;
    this._prompt = prompt;
  }

  static singleChoice(prompt: string): QuestionBuilder {
    return new QuestionBuilder('single_choice', prompt);
  }

  static multipleSelect(prompt: string): QuestionBuilder {
    return new QuestionBuilder('multiple_select', prompt);
  }

  static trueFalse(prompt: string, answer: boolean): QuestionBuilder {
    const b = new QuestionBuilder('true_false', prompt);
    b._answer = { answer };
    return b;
  }

  static shortAnswer(prompt: string, accepted: string[]): QuestionBuilder {
    const b = new QuestionBuilder('short_answer', prompt);
    b._answer = { accepted };
    return b;
  }

  static essay(prompt: string): QuestionBuilder {
    return new QuestionBuilder('essay', prompt);
  }

  static matching(prompt: string): QuestionBuilder {
    return new QuestionBuilder('matching', prompt);
  }

  static ordering(prompt: string, items: string[]): QuestionBuilder {
    const b = new QuestionBuilder('ordering', prompt);
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    b._options = items.map((label, idx) => ({ key: letters[idx], label, side: null }));
    b._answer = { order: b._options.map((o) => o.key) };
    return b;
  }

  withOption(key: string, label: string, isCorrect = false, side?: 'left' | 'right'): this {
    this._options.push({ key, label, side: side ?? null });
    if (this._type === 'single_choice' && isCorrect) {
      this._answer = { answer: key };
    } else if (this._type === 'multiple_select' && isCorrect) {
      const current = this._answer.answers || [];
      this._answer = { answers: [...current, key] };
    }
    return this;
  }

  withMatchingPair(leftLabel: string, rightLabel: string): this {
    const idx = this._options.filter((o) => o.side === 'left').length + 1;
    const leftKey = `L${idx}`;
    const rightKey = `R${idx}`;
    this._options.push({ key: leftKey, label: leftLabel, side: 'left' });
    this._options.push({ key: rightKey, label: rightLabel, side: 'right' });
    const pairs = this._answer.pairs || {};
    pairs[leftKey] = rightKey;
    this._answer = { pairs };
    return this;
  }

  explanation(exp: string | null): this {
    this._explanation = exp;
    return this;
  }

  difficulty(d: 'easy' | 'medium' | 'hard' | null): this {
    this._difficulty = d;
    return this;
  }

  topic(t: string | null): this {
    this._topic = t;
    return this;
  }

  status(s: Status): this {
    this._status = s;
    return this;
  }

  materials(ids: string[]): this {
    this._materialIds = ids;
    return this;
  }

  tags(t: string[]): this {
    this._tags = t;
    return this;
  }

  media(url: string | null): this {
    this._mediaUrl = url;
    return this;
  }

  validate(): ValidationResult {
    const errors: string[] = [];
    if (!this._prompt || this._prompt.trim() === '') {
      errors.push('Teks soal tidak boleh kosong.');
    }
    const regResult = QuestionRegistry.validate(this._type, this._options, this._answer);
    if (!regResult.valid) {
      errors.push(...regResult.errors);
    }
    return { valid: errors.length === 0, errors };
  }

  build() {
    const v = this.validate();
    if (!v.valid) {
      throw new Error(`Invalid Question: ${v.errors.join('; ')}`);
    }
    return {
      type: this._type,
      prompt: this._prompt,
      options: this._options,
      answer: this._answer,
      explanation: this._explanation,
      difficulty: this._difficulty,
      topic: this._topic,
      status: this._status,
      material_ids: this._materialIds,
      tags: this._tags,
      media_url: this._mediaUrl,
    };
  }
}

export class AssessmentDSL {
  static createQuiz(title: string): QuizBuilder {
    return new QuizBuilder(title);
  }

  static question(type: QuestionType, prompt: string): QuestionBuilder {
    return new QuestionBuilder(type, prompt);
  }
}
