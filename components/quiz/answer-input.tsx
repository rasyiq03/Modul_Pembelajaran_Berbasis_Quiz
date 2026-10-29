'use client';

import { ArrowDown, ArrowUp, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnswerKey, QuestionPayload, Response } from '@/lib/quiz/types';
import { plain, rich } from '@/lib/rich';

/* Empat bentuk & warna jawaban seperti panggung kuis di materi */
const SHAPES = [
  { color: 'bg-kahoot-red', path: <path d="M16 3 30 28H2z" /> },
  { color: 'bg-kahoot-blue', path: <path d="M16 2 30 16 16 30 2 16z" /> },
  { color: 'bg-kahoot-yellow', path: <circle cx="16" cy="16" r="13" /> },
  { color: 'bg-kahoot-green', path: <rect x="4" y="4" width="24" height="24" /> },
];
const Shape = ({ i }: { i: number }) => (
  <svg viewBox="0 0 32 32" className="h-6 w-6 shrink-0 fill-white" aria-hidden="true">{SHAPES[i % 4].path}</svg>
);

/**
 * Input jawaban untuk ketujuh jenis soal. `reveal` (kunci dari server) menandai jawaban benar/salah
 * saat menampilkan pembahasan; komponen tidak pernah menerima kunci sebelum server membukanya.
 */
export function AnswerInput({
  question: q,
  value,
  onChange,
  disabled,
  reveal,
}: {
  question: QuestionPayload;
  value: Response | undefined;
  onChange: (r: Response) => void;
  disabled?: boolean;
  reveal?: AnswerKey | null;
}) {
  const v = (value ?? {}) as any;
  const correctKeys: string[] | null = reveal
    ? q.type === 'single_choice' ? [reveal.answer] : q.type === 'multiple_select' ? reveal.answers ?? [] : null
    : null;

  if (q.type === 'single_choice' || q.type === 'multiple_select') {
    const multi = q.type === 'multiple_select';
    const selected: string[] = multi ? v.selected ?? [] : v.selected ? [v.selected] : [];
    return (
      <div className="grid gap-3 sm:grid-cols-2" role={multi ? 'group' : 'radiogroup'}>
        {multi && <p className="col-span-full -mb-1 font-heading text-xs font-bold text-muted-foreground">Pilih semua jawaban yang benar.</p>}
        {q.options.map((o, i) => {
          const on = selected.includes(o.key);
          const right = correctKeys?.includes(o.key);
          return (
            <button
              key={o.key}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(multi ? { selected: on ? selected.filter((k) => k !== o.key) : [...selected, o.key] } : { selected: o.key })}
              className={cn(
                'flex min-h-[64px] items-center gap-3 rounded-md px-4 py-3 text-left font-heading text-[0.95rem] font-bold text-white shadow-[0_4px_0_rgba(0,0,0,.25)] transition',
                SHAPES[i % 4].color,
                on ? 'ring-4 ring-ring ring-offset-2 ring-offset-background' : 'opacity-95 hover:opacity-100',
                disabled && !on && 'opacity-60',
                correctKeys && !right && 'opacity-40',
              )}
            >
              <Shape i={i} />
              <span className="flex-1" dangerouslySetInnerHTML={{ __html: rich(o.label) }} />
              {correctKeys && (right ? <Check className="h-5 w-5" aria-label="Jawaban benar" /> : on ? <X className="h-5 w-5" aria-label="Salah" /> : null)}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'true_false') {
    return (
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
        {[true, false].map((b, i) => {
          const on = v.answer === b;
          const right = reveal ? reveal.answer === b : null;
          return (
            <button
              key={String(b)}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange({ answer: b })}
              className={cn(
                'flex min-h-[64px] items-center gap-3 rounded-md px-4 font-heading text-lg font-extrabold text-white shadow-[0_4px_0_rgba(0,0,0,.25)]',
                i === 0 ? 'bg-kahoot-green' : 'bg-kahoot-red',
                on && 'ring-4 ring-ring ring-offset-2 ring-offset-background',
                right === false && 'opacity-40',
              )}
            >
              <Shape i={i === 0 ? 3 : 0} /> {b ? 'Benar' : 'Salah'}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'short_answer') {
    return (
      <input
        className="w-full rounded-md border-[1.5px] border-input bg-card px-4 py-3 font-heading text-base font-semibold"
        placeholder="Tulis jawabanmu"
        value={v.answer ?? ''}
        disabled={disabled}
        onChange={(e) => onChange({ answer: e.target.value })}
        aria-label="Jawaban singkat"
      />
    );
  }

  if (q.type === 'essay') {
    return (
      <textarea
        className="min-h-[160px] w-full rounded-md border-[1.5px] border-input bg-card px-4 py-3 text-base"
        placeholder="Tulis jawaban esaimu. Esai dinilai manual oleh pengajar."
        value={v.answer ?? ''}
        disabled={disabled}
        onChange={(e) => onChange({ answer: e.target.value })}
        aria-label="Jawaban esai"
      />
    );
  }

  if (q.type === 'matching') {
    const lefts = q.options.filter((o) => o.side === 'left');
    const rights = q.options.filter((o) => o.side === 'right');
    const pairs: Record<string, string> = v.pairs ?? {};
    return (
      <div className="space-y-2">
        {lefts.map((l) => {
          const ok = reveal ? reveal.pairs?.[l.key] === pairs[l.key] : null;
          return (
            <div key={l.key} className={cn('grid items-center gap-2 rounded-md border-[1.5px] bg-card p-3 sm:grid-cols-[1fr_auto_1fr]', ok === false && 'border-destructive', ok && 'border-success')}>
              <span className="font-heading text-sm font-bold" dangerouslySetInnerHTML={{ __html: rich(l.label) }} />
              <span className="hidden text-muted-foreground sm:block" aria-hidden="true">→</span>
              <select
                className="rounded-md border-[1.5px] border-input bg-background px-3 py-2 font-heading text-sm"
                value={pairs[l.key] ?? ''}
                disabled={disabled}
                aria-label={`Pasangan untuk ${plain(l.label)}`}
                onChange={(e) => onChange({ pairs: { ...pairs, [l.key]: e.target.value } })}
              >
                <option value="">Pilih pasangan…</option>
                {rights.map((r) => <option key={r.key} value={r.key}>{plain(r.label)}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    );
  }

  /* ordering */
  const order: string[] = v.order ?? q.options.map((o) => o.key);
  const move = (i: number, d: number) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange({ order: next });
  };
  return (
    <ol className="space-y-2">
      {order.map((k, i) => {
        const o = q.options.find((x) => x.key === k);
        const ok = reveal ? reveal.order?.[i] === k : null;
        return (
          <li key={k} className={cn('flex items-center gap-3 rounded-md border-[1.5px] bg-card p-3', ok === false && 'border-destructive', ok && 'border-success')}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary font-heading text-sm font-extrabold">{i + 1}</span>
            <span className="flex-1 font-heading text-sm font-bold" dangerouslySetInnerHTML={{ __html: rich(o?.label ?? k) }} />
            <button type="button" className="rounded p-1.5 hover:bg-secondary disabled:opacity-30" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label="Naikkan">
              <ArrowUp className="h-4 w-4" />
            </button>
            <button type="button" className="rounded p-1.5 hover:bg-secondary disabled:opacity-30" disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} aria-label="Turunkan">
              <ArrowDown className="h-4 w-4" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Teks soal: materi memakai sedikit tag format (<b>, <i>, <sub>, <code>) */
export function Prompt({ html, className }: { html: string; className?: string }) {
  return <div className={cn('font-heading text-lg font-bold leading-snug sm:text-xl', className)} dangerouslySetInnerHTML={{ __html: rich(html) }} />;
}
