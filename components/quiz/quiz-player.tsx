'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Loader2, LogIn, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AnswerInput, Prompt } from '@/components/quiz/answer-input';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage } from '@/lib/labels';
import { describeAnswer, initialResponse, isAnswered, type QuestionPayload, type Response } from '@/lib/quiz/types';
import { rich } from '@/lib/rich';
import { cn } from '@/lib/utils';

type Started = {
  attempt_id: string; deadline_at: string | null; server_now: string;
  quiz: { id: string; title: string; mode: string; show_feedback: 'after_each' | 'after_submit' | 'never' };
  questions: QuestionPayload[];
};
type Checked = { correct: boolean | null; answer: any; explanation: string | null };

const store = {
  get(k: string) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* mode privat */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* mode privat */ } },
};

export function QuizPlayer({
  quizId, allowGuests, isRegistered, isPreview,
}: { quizId: string; allowGuests: boolean; isRegistered: boolean; isPreview: boolean }) {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [nickname, setNickname] = useState('');
  const [data, setData] = useState<Started | null>(null);
  const [answers, setAnswers] = useState<Record<string, Response>>({});
  const [checked, setChecked] = useState<Record<string, Checked>>({});
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const submitted = useRef(false);
  const skew = useRef(0);
  const key = data ? `kk:attempt:${data.attempt_id}` : '';

  async function start() {
    setBusy(true); setError(null);
    try {
      /* Tamu: masuk anonim bila kuis mengizinkan (FR-44) */
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!allowGuests) throw new Error('LOGIN_REQUIRED');
        const { error: e } = await supabase.auth.signInAnonymously();
        if (e) throw e;
      }
      const { data: d, error: e } = await supabase.rpc('start_quiz_attempt', { p_quiz: quizId, p_nickname: nickname || null });
      if (e) throw e;
      const s = d as Started;
      skew.current = Date.parse(s.server_now) - Date.now();
      setData(s);
      const saved = store.get(`kk:attempt:${s.attempt_id}`);
      setAnswers(saved?.answers ?? Object.fromEntries(s.questions.map((q) => [q.id, initialResponse(q)]).filter(([, r]) => r)));
      setI(saved?.i ?? 0);
    } catch (e) {
      setError(errorMessage(e));
    } finally { setBusy(false); }
  }

  useEffect(() => { if (data) store.set(key, { answers, i }); }, [answers, i, data, key]);

  const submit = useCallback(async () => {
    if (!data || submitted.current) return;
    submitted.current = true; setBusy(true); setError(null);
    const { error: e } = await supabase.rpc('submit_quiz_attempt', { p_attempt: data.attempt_id, p_responses: answers });
    if (e && !/ALREADY_SUBMITTED/.test(e.message)) {
      submitted.current = false; setBusy(false); setError(errorMessage(e)); return;
    }
    store.del(key);
    router.push(`/attempts/${data.attempt_id}`);
  }, [data, answers, supabase, key, router]);

  /* Hitung mundur dengan jam server; kirim otomatis saat habis */
  useEffect(() => {
    if (!data?.deadline_at) return;
    const end = Date.parse(data.deadline_at);
    const tick = () => {
      const s = Math.max(0, Math.round((end - (Date.now() + skew.current)) / 1000));
      setLeft(s);
      if (s === 0) submit();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data, submit]);

  const q = data?.questions[i];
  const answeredCount = useMemo(() => (data ? data.questions.filter((x) => isAnswered(x, answers[x.id])).length : 0), [data, answers]);
  const practice = data?.quiz.show_feedback === 'after_each';

  async function check() {
    if (!data || !q) return;
    setBusy(true);
    const { data: r, error: e } = await supabase.rpc('check_practice_answer', { p_attempt: data.attempt_id, p_question: q.id, p_response: answers[q.id] ?? null });
    setBusy(false);
    if (e) return setError(errorMessage(e));
    setChecked((c) => ({ ...c, [q.id]: r as Checked }));
  }

  /* ---------- Layar awal ---------- */
  if (!data) {
    const needLogin = !isRegistered && !allowGuests;
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          {isPreview && <p className="note-box-warn text-sm">Mode pratinjau admin: hasil tidak masuk statistik.</p>}
          {needLogin ? (
            <>
              <p className="text-muted-foreground">Kuis ini hanya untuk pengguna terdaftar.</p>
              <Button asChild><Link href={`/signin?next=/quizzes/${quizId}`}><LogIn className="mr-1 h-4 w-4" /> Masuk untuk mengerjakan</Link></Button>
            </>
          ) : (
            <>
              {!isRegistered && (
                <div className="max-w-sm space-y-2">
                  <Label htmlFor="nick">Nama tampilan (opsional)</Label>
                  <Input id="nick" maxLength={24} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="mis. Budi" />
                  <p className="text-xs text-muted-foreground">Kamu mengerjakan sebagai tamu. Masuk bila ingin hasilnya tersimpan di riwayat akunmu.</p>
                </div>
              )}
              <Button size="lg" onClick={start} disabled={busy}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Mulai kuis
              </Button>
            </>
          )}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  /* ---------- Mengerjakan ---------- */
  const c = q ? checked[q.id] : undefined;
  const last = i === data.questions.length - 1;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 font-heading text-sm">
        <span className="font-bold">Soal {i + 1} dari {data.questions.length}</span>
        <span className="text-muted-foreground">{answeredCount} terjawab</span>
        {left !== null && (
          <span className={cn('inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 font-bold', left <= 60 && 'bg-destructive text-destructive-foreground')} aria-live="polite">
            <Clock className="h-4 w-4" /> {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div className="h-full bg-primary transition-all" style={{ width: `${((i + 1) / data.questions.length) * 100}%` }} />
      </div>

      {q && (
        <Card>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <Prompt html={q.prompt} />
              {q.points != null && <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 font-heading text-xs font-bold">{q.points} poin</span>}
            </div>
            {q.media_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={q.media_url} alt="" className="max-h-72 rounded-md border" />}
            <AnswerInput
              question={q}
              value={answers[q.id]}
              onChange={(r) => setAnswers((a) => ({ ...a, [q.id]: r }))}
              disabled={busy || !!c}
              reveal={c?.answer ?? null}
            />
            {c && (
              <div className={cn('rounded-md p-3 text-sm', c.correct ? 'bg-success/10' : 'bg-destructive/10')}>
                <p className="flex items-center gap-1.5 font-heading font-bold">
                  {c.correct ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  {c.correct === null ? 'Dinilai manual' : c.correct ? 'Benar!' : 'Kurang tepat'}
                </p>
                <p className="mt-1"><b>Jawaban:</b> <span dangerouslySetInnerHTML={{ __html: rich(describeAnswer(q, c.answer)) }} /></p>
                {c.explanation && <p className="mt-1 text-muted-foreground" dangerouslySetInnerHTML={{ __html: rich(c.explanation) }} />}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setI((x) => x - 1)} disabled={i === 0 || busy}><ArrowLeft className="mr-1 h-4 w-4" /> Sebelumnya</Button>
        <div className="flex gap-2">
          {practice && q && !c && <Button variant="outline" onClick={check} disabled={busy || !isAnswered(q, answers[q.id])}>Periksa jawaban</Button>}
          {!last && <Button onClick={() => setI((x) => x + 1)} disabled={busy}>Berikutnya <ArrowRight className="ml-1 h-4 w-4" /></Button>}
          {last && (
            <Button
              onClick={() => {
                const blank = data.questions.length - answeredCount;
                if (blank > 0 && !confirm(`${blank} soal belum dijawab. Kirim sekarang?`)) return;
                submit();
              }}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Kirim jawaban
            </Button>
          )}
        </div>
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Lompat ke soal">
        {data.questions.map((x, k) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setI(k)}
            aria-current={k === i ? 'step' : undefined}
            className={cn('h-8 w-8 rounded-md border-[1.5px] font-heading text-xs font-bold',
              k === i ? 'border-primary bg-primary text-primary-foreground' : isAnswered(x, answers[x.id]) ? 'border-primary/40 bg-secondary' : 'bg-card')}
          >
            {k + 1}
          </button>
        ))}
      </nav>
    </div>
  );
}
