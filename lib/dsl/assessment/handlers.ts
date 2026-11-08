import type { QuestionOption, QuestionTypeHandler, ValidationResult } from './types';

const findLabel = (options: QuestionOption[], key: string) =>
  options.find((o) => o.key === key)?.label ?? key;

export const SingleChoiceHandler: QuestionTypeHandler<{ answer: string }, { selected: string }> = {
  type: 'single_choice',
  label: 'Pilihan tunggal',

  isAnswered(response) {
    return !!response && typeof response.selected === 'string' && response.selected.trim() !== '';
  },

  initialResponse() {
    return undefined;
  },

  describeAnswer(answer, options) {
    if (!answer?.answer) return '';
    return findLabel(options, answer.answer);
  },

  describeResponse(response, options) {
    if (!response?.selected) return 'Tidak dijawab';
    return findLabel(options, response.selected);
  },

  gradeLocally(response, answer) {
    if (!response || !answer) return false;
    return response.selected === answer.answer;
  },

  validate(options, answer): ValidationResult {
    const errors: string[] = [];
    if (!options || options.length < 2) errors.push('Pilihan tunggal butuh minimal 2 opsi.');
    if (!answer?.answer || !options.some((o) => o.key === answer.answer)) {
      errors.push('Tandai satu pilihan jawaban yang benar.');
    }
    return { valid: errors.length === 0, errors };
  },
};

export const MultipleSelectHandler: QuestionTypeHandler<{ answers: string[] }, { selected: string[] }> = {
  type: 'multiple_select',
  label: 'Pilihan ganda jamak',

  isAnswered(response) {
    return !!response && Array.isArray(response.selected) && response.selected.length > 0;
  },

  initialResponse() {
    return undefined;
  },

  describeAnswer(answer, options) {
    if (!answer?.answers || !Array.isArray(answer.answers)) return '';
    return answer.answers.map((k) => findLabel(options, k)).join('; ');
  },

  describeResponse(response, options) {
    if (!response?.selected || !Array.isArray(response.selected) || response.selected.length === 0) {
      return 'Tidak dijawab';
    }
    return response.selected.map((k) => findLabel(options, k)).join('; ');
  },

  gradeLocally(response, answer) {
    if (!response?.selected || !answer?.answers) return false;
    const a = [...response.selected].sort();
    const b = [...answer.answers].sort();
    return a.length === b.length && a.every((v, idx) => v === b[idx]);
  },

  validate(options, answer): ValidationResult {
    const errors: string[] = [];
    if (!options || options.length < 2) errors.push('Pilihan jamak butuh minimal 2 opsi.');
    if (!answer?.answers || !Array.isArray(answer.answers) || answer.answers.length === 0) {
      errors.push('Tandai minimal satu pilihan jawaban benar.');
    }
    return { valid: errors.length === 0, errors };
  },
};

export const TrueFalseHandler: QuestionTypeHandler<{ answer: boolean }, { answer: boolean }> = {
  type: 'true_false',
  label: 'Benar/salah',

  isAnswered(response) {
    return !!response && typeof response.answer === 'boolean';
  },

  initialResponse() {
    return undefined;
  },

  describeAnswer(answer) {
    if (answer?.answer === undefined || answer?.answer === null) return '';
    return answer.answer ? 'Benar' : 'Salah';
  },

  describeResponse(response) {
    if (!response || typeof response.answer !== 'boolean') return 'Tidak dijawab';
    return response.answer ? 'Benar' : 'Salah';
  },

  gradeLocally(response, answer) {
    if (!response || !answer) return false;
    return response.answer === answer.answer;
  },

  validate(_, answer): ValidationResult {
    const errors: string[] = [];
    if (typeof answer?.answer !== 'boolean') errors.push('Tentukan kunci Benar atau Salah.');
    return { valid: errors.length === 0, errors };
  },
};

export const ShortAnswerHandler: QuestionTypeHandler<{ accepted: string[] }, { answer: string }> = {
  type: 'short_answer',
  label: 'Jawaban singkat',

  isAnswered(response) {
    return !!response && typeof response.answer === 'string' && response.answer.trim() !== '';
  },

  initialResponse() {
    return undefined;
  },

  describeAnswer(answer) {
    return (answer?.accepted ?? []).join(' / ');
  },

  describeResponse(response) {
    return response?.answer?.trim() || 'Tidak dijawab';
  },

  gradeLocally(response, answer) {
    if (!response?.answer || !answer?.accepted) return false;
    const clean = response.answer.trim().toLowerCase().replace(/\s+/g, ' ');
    return answer.accepted.some((a) => a.trim().toLowerCase().replace(/\s+/g, ' ') === clean);
  },

  validate(_, answer): ValidationResult {
    const errors: string[] = [];
    const acc = (answer?.accepted ?? []).filter((x: string) => x && x.trim() !== '');
    if (acc.length === 0) errors.push('Isi minimal satu jawaban yang diterima.');
    return { valid: errors.length === 0, errors };
  },
};

export const EssayHandler: QuestionTypeHandler<Record<string, never>, { answer: string }> = {
  type: 'essay',
  label: 'Esai',

  isAnswered(response) {
    return !!response && typeof response.answer === 'string' && response.answer.trim() !== '';
  },

  initialResponse() {
    return undefined;
  },

  describeAnswer() {
    return 'Dinilai manual oleh pengajar';
  },

  describeResponse(response) {
    return response?.answer?.trim() || 'Tidak dijawab';
  },

  gradeLocally() {
    return null; // Memerlukan penilaian manual
  },

  validate(): ValidationResult {
    return { valid: true, errors: [] };
  },
};

export const MatchingHandler: QuestionTypeHandler<{ pairs: Record<string, string> }, { pairs: Record<string, string> }> = {
  type: 'matching',
  label: 'Menjodohkan',

  isAnswered(response, options) {
    if (!response?.pairs || typeof response.pairs !== 'object') return false;
    const lefts = options.filter((o) => o.side === 'left');
    return lefts.length > 0 && lefts.every((l) => !!response.pairs[l.key]);
  },

  initialResponse() {
    return undefined;
  },

  describeAnswer(answer, options) {
    if (!answer?.pairs) return '';
    return Object.entries(answer.pairs)
      .map(([l, r]) => `${findLabel(options, l)} → ${findLabel(options, r as string)}`)
      .join('; ');
  },

  describeResponse(response, options) {
    if (!response?.pairs || Object.keys(response.pairs).length === 0) return 'Tidak dijawab';
    return Object.entries(response.pairs)
      .map(([l, r]) => `${findLabel(options, l)} → ${findLabel(options, r as string)}`)
      .join('; ');
  },

  gradeLocally(response, answer, options) {
    if (!response?.pairs || !answer?.pairs) return false;
    const lefts = options.filter((o) => o.side === 'left');
    for (const l of lefts) {
      if (response.pairs[l.key] !== answer.pairs[l.key]) return false;
    }
    return true;
  },

  validate(options, answer): ValidationResult {
    const errors: string[] = [];
    const lefts = options.filter((o) => o.side === 'left');
    const rights = options.filter((o) => o.side === 'right');
    if (lefts.length < 2 || rights.length < 2) {
      errors.push('Menjodohkan butuh minimal 2 butir kiri dan 2 kanan.');
    }
    if (!answer?.pairs || typeof answer.pairs !== 'object') {
      errors.push('Pasangan belum ditentukan.');
    } else {
      for (const l of lefts) {
        if (!answer.pairs[l.key]) errors.push(`Butir "${l.label}" belum memiliki pasangan.`);
      }
    }
    return { valid: errors.length === 0, errors };
  },
};

export const OrderingHandler: QuestionTypeHandler<{ order: string[] }, { order: string[] }> = {
  type: 'ordering',
  label: 'Mengurutkan',

  isAnswered(response, options) {
    return !!response && Array.isArray(response.order) && response.order.length === options.length;
  },

  initialResponse(options) {
    return { order: options.map((o) => o.key) };
  },

  describeAnswer(answer, options) {
    if (!answer?.order || !Array.isArray(answer.order)) return '';
    return answer.order.map((k) => findLabel(options, k)).join(' → ');
  },

  describeResponse(response, options) {
    if (!response?.order || !Array.isArray(response.order) || response.order.length === 0) {
      return 'Tidak dijawab';
    }
    return response.order.map((k) => findLabel(options, k)).join(' → ');
  },

  gradeLocally(response, answer) {
    if (!response?.order || !answer?.order) return false;
    if (response.order.length !== answer.order.length) return false;
    return response.order.every((k, idx) => k === answer.order[idx]);
  },

  validate(options, answer): ValidationResult {
    const errors: string[] = [];
    if (!options || options.length < 2) errors.push('Mengurutkan butuh minimal 2 butir.');
    if (!answer?.order || !Array.isArray(answer.order) || answer.order.length !== options.length) {
      errors.push('Urutan kunci harus memuat semua butir.');
    }
    return { valid: errors.length === 0, errors };
  },
};
