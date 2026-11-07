import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Prompt } from '@/components/quiz/answer-input';
import { ExplanationLocked } from '@/components/subscription/explanation-locked';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { choicesOf, correctIndex, fmtPts } from '@/lib/arena';
import { fmtDateTime, fmtNum } from '@/lib/labels';
import { rich } from '@/lib/rich';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hasil Arena · Cognify' };

export default async function ArenaRunPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireUser(`/arena/runs/${params.id}`);
  const { data: r, error } = await createSupabaseServer().rpc('arena_result', { p_run: params.id });
  if (error || !r) notFound();
  const items = (r.items ?? []) as any[];
  const again = r.quiz_id ? `/arena/quiz/${r.quiz_id}` : `/arena/course/${r.course_slug}`;
  const locked = items.some((it) => it.explanation_locked);

  return (
    <div className="container-page space-y-6 py-10">
      <header className="space-y-2">
        <p className="eyebrow">Hasil Arena</p>
        <h1 className="text-[clamp(1.8rem,4vw,2.6rem)]">{r.title}</h1>
        <p className="font-heading text-sm text-muted-foreground">
          {r.status === 'finished' ? `Selesai ${fmtDateTime(r.finished_at)}` : `Dimulai ${fmtDateTime(r.started_at)} · tidak diselesaikan`}
        </p>
      </header>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-4">
          <div><div className="eyebrow">Skor</div><div className="font-heading text-3xl font-extrabold">{fmtPts(r.score)}</div></div>
          <div><div className="eyebrow">Benar</div><div className="font-heading text-3xl font-extrabold">{r.correct}<span className="text-lg text-muted-foreground"> / {r.count}</span></div></div>
          <div><div className="eyebrow">Beruntun terbaik</div><div className="font-heading text-3xl font-extrabold">×{r.best_streak}</div></div>
          <div className="flex items-end gap-2 sm:justify-end">
            <Button asChild size="sm"><Link href={again}>Main lagi</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/dashboard/history">Riwayat</Link></Button>
          </div>
        </CardContent>
      </Card>

      {locked && <ExplanationLocked />}

      <ol className="space-y-3">
        {items.map((it, k) => {
          const q = it.question;
          const choices = choicesOf(q);
          const key = correctIndex(q, it.answer);
          const mine = it.response ? choices.findIndex((c) => JSON.stringify(c.response) === JSON.stringify(it.response)) : -1;
          return (
            <li key={k}>
              <Card className={cn(it.is_correct ? 'border-success/40' : 'border-destructive/40')}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5">{it.is_correct ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}</span>
                    <div className="flex-1 space-y-1">
                      <p className="eyebrow">Soal {k + 1} · +{fmtPts(it.points)} poin{it.time_ms != null && <> · <Clock className="inline h-3 w-3" /> {fmtNum(it.time_ms / 1000)} dtk</>}</p>
                      <Prompt html={q.prompt} className="text-base sm:text-lg" />
                    </div>
                  </div>
                  <dl className="grid gap-1 text-sm sm:grid-cols-[9rem_1fr]">
                    <dt className="font-heading font-bold text-muted-foreground">Jawabanmu</dt>
                    <dd dangerouslySetInnerHTML={{ __html: mine >= 0 ? rich(choices[mine].label) : 'Waktu habis' }} />
                    {key >= 0 && <>
                      <dt className="font-heading font-bold text-muted-foreground">Kunci</dt>
                      <dd dangerouslySetInnerHTML={{ __html: rich(choices[key].label) }} />
                    </>}
                  </dl>
                  {it.explanation && <p className="note-box text-sm" dangerouslySetInnerHTML={{ __html: rich(it.explanation) }} />}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
