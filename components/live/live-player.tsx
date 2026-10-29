'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, Loader2, Send, Trophy, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AnswerInput, Prompt } from '@/components/quiz/answer-input';
import { Leaderboard } from '@/components/live/leaderboard';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage, fmtNum } from '@/lib/labels';
import { useSessionState } from '@/lib/quiz/use-session-state';
import { describeAnswer, initialResponse, isAnswered, type Response } from '@/lib/quiz/types';
import { rich } from '@/lib/rich';
import { cn } from '@/lib/utils';

/** Layar peserta kuis live (FR-52..58, 60) */
export function LivePlayer({ sessionId }: { sessionId: string }) {
  const { state: s, error, secondsLeft, refresh } = useSessionState(sessionId);
  const [resp, setResp] = useState<Response | undefined>();
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const qid = s?.question?.id;

  /* Soal baru: kosongkan jawaban */
  useEffect(() => {
    setResp(s?.question ? initialResponse(s.question) : undefined);
    setSendError(null);
  }, [qid, s?.index]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (!s) return;
    setBusy(true); setSendError(null);
    const { error: e } = await getSupabaseBrowser().rpc('submit_live_answer', { p_session: s.session_id, p_response: resp ?? null });
    setBusy(false);
    if (e) setSendError(errorMessage(e));
    refresh();
  }

  if (error && !s) {
    return (
      <Card><CardContent className="space-y-3 p-6 text-center">
        <p className="text-destructive">{error}</p>
        <Button asChild variant="outline"><Link href="/join">Gabung lagi dengan kode</Link></Button>
      </CardContent></Card>
    );
  }
  if (!s) return <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2 font-heading text-sm">
      <span className="font-bold">{s.quiz_title}</span>
      {s.me && <span className="rounded-full bg-secondary px-3 py-1 font-bold">{s.me.nickname} · {fmtNum(s.me.score, 0)} poin</span>}
    </div>
  );

  if (s.phase === 'lobby') {
    return (
      <div className="space-y-6">{header}
        <Card className="bg-primary text-primary-foreground"><CardContent className="space-y-2 p-10 text-center">
          <p className="font-heading text-2xl font-extrabold">Kamu sudah masuk!</p>
          <p className="opacity-90">Tunggu pengajar memulai kuis. {s.participants} peserta sudah bergabung.</p>
          <Loader2 className="mx-auto mt-2 h-6 w-6 animate-spin" aria-hidden="true" />
        </CardContent></Card>
      </div>
    );
  }

  if (s.phase === 'ended') {
    return (
      <div className="space-y-6">{header}
        <Card><CardContent className="space-y-4 p-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-warning" />
          <p className="font-heading text-2xl font-extrabold">Kuis selesai</p>
          {s.me && <p className="text-lg">Skormu <b>{fmtNum(s.me.score, 0)}</b> · {s.me.correct} dari {s.count} benar</p>}
        </CardContent></Card>
        {s.leaderboard && <Leaderboard rows={s.leaderboard} />}
        <Button asChild variant="outline"><Link href="/quizzes">Lihat kuis lain</Link></Button>
      </div>
    );
  }

  const q = s.question;
  const answered = s.me?.answered_current;
  const timeUp = secondsLeft === 0;
  return (
    <div className="space-y-4">{header}
      <div className="flex items-center justify-between font-heading text-sm">
        <span className="font-bold">Soal {s.index + 1} dari {s.count}</span>
        {s.phase === 'question' && secondsLeft !== null && (
          <span className={cn('inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-base font-extrabold', secondsLeft <= 5 && 'bg-destructive text-destructive-foreground')} aria-live="polite">
            <Clock className="h-4 w-4" /> {secondsLeft}
          </span>
        )}
      </div>
      {q && (
        <Card>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <Prompt html={q.prompt} />
            {s.phase === 'question' && !answered && !timeUp && (
              <>
                <AnswerInput question={q} value={resp} onChange={setResp} disabled={busy} />
                {sendError && <p className="text-sm text-destructive" role="alert">{sendError}</p>}
                <Button size="lg" className="w-full" onClick={send} disabled={busy || !isAnswered(q, resp)}>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Kirim jawaban
                </Button>
              </>
            )}
            {s.phase === 'question' && (answered || timeUp) && (
              <p className="rounded-md bg-secondary p-4 text-center font-heading font-bold">
                {answered ? 'Jawaban terkirim. Tunggu yang lain…' : 'Waktu habis. Tunggu pengajar membuka jawabannya.'}
              </p>
            )}
            {s.phase === 'reveal' && (
              <div className="space-y-3">
                {s.me?.last ? (
                  <p className={cn('flex items-center gap-2 font-heading text-xl font-extrabold', s.me.last.is_correct ? 'text-success' : 'text-destructive')}>
                    {s.me.last.is_correct ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                    {s.me.last.is_correct ? `Benar! +${fmtNum(s.me.last.points, 0)}` : 'Kurang tepat'}
                  </p>
                ) : <p className="font-heading font-bold text-muted-foreground">Kamu tidak menjawab soal ini.</p>}
                {s.answer && <p><b>Jawaban:</b> <span dangerouslySetInnerHTML={{ __html: rich(describeAnswer(q, s.answer)) }} /></p>}
                {s.explanation && <p className="note-box text-sm" dangerouslySetInnerHTML={{ __html: rich(s.explanation) }} />}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {s.phase === 'reveal' && s.leaderboard && <Leaderboard rows={s.leaderboard} limit={5} />}
    </div>
  );
}
