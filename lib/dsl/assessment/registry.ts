import type { QuestionType } from '@/lib/database.types';
import type {
  AnswerKeyPayload,
  QuestionOption,
  QuestionPayload,
  QuestionTypeHandler,
  ResponsePayload,
  ValidationResult,
} from './types';
import {
  SingleChoiceHandler,
  MultipleSelectHandler,
  TrueFalseHandler,
  ShortAnswerHandler,
  EssayHandler,
  MatchingHandler,
  OrderingHandler,
} from './handlers';

export class QuestionRegistry {
  private static handlers = new Map<QuestionType, QuestionTypeHandler>([
    ['single_choice', SingleChoiceHandler],
    ['multiple_select', MultipleSelectHandler],
    ['true_false', TrueFalseHandler],
    ['short_answer', ShortAnswerHandler],
    ['essay', EssayHandler],
    ['matching', MatchingHandler],
    ['ordering', OrderingHandler],
  ]);

  static register(handler: QuestionTypeHandler) {
    this.handlers.set(handler.type, handler);
  }

  static get(type: QuestionType): QuestionTypeHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`Question type handler for "${type}" is not registered.`);
    }
    return handler;
  }

  static isAnswered(question: QuestionPayload, response: ResponsePayload | undefined): boolean {
    const handler = this.handlers.get(question.type);
    return handler ? handler.isAnswered(response, question.options) : false;
  }

  static initialResponse(question: QuestionPayload): ResponsePayload | undefined {
    const handler = this.handlers.get(question.type);
    return handler ? handler.initialResponse(question.options) : undefined;
  }

  static describeAnswer(
    question: { type: QuestionType; options: QuestionOption[] },
    answerKey: AnswerKeyPayload,
  ): string {
    const handler = this.handlers.get(question.type);
    return handler ? handler.describeAnswer(answerKey, question.options) : '';
  }

  static describeResponse(
    question: { type: QuestionType; options: QuestionOption[] },
    response: ResponsePayload | undefined,
  ): string {
    const handler = this.handlers.get(question.type);
    return handler ? handler.describeResponse(response, question.options) : 'Tidak dijawab';
  }

  static gradeLocally(
    question: QuestionPayload,
    response: ResponsePayload,
    answer: AnswerKeyPayload,
  ): boolean | null {
    const handler = this.handlers.get(question.type);
    if (!handler || !handler.gradeLocally) return null;
    return handler.gradeLocally(response, answer, question.options);
  }

  static validate(
    type: QuestionType,
    options: QuestionOption[],
    answer: AnswerKeyPayload,
  ): ValidationResult {
    const handler = this.handlers.get(type);
    if (!handler || !handler.validate) return { valid: true, errors: [] };
    return handler.validate(options, answer);
  }
}
