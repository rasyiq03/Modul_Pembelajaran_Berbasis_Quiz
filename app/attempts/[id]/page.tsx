import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/site/page-parts';
import { XpGainBox } from '@/components/gamification/cards';
import { XpSync } from '@/components/gamification/level-parts';
import { gainsFor } from '@/lib/gamification-server';
import { GradeAnswer } from '@/components/quiz/grade-answer';
import { Prompt } from '@/components/quiz/answer-input';
import { getViewer } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { describeAnswer, describeResponse } from '@/lib/quiz/types';
import { fmtDateTime, fmtNum } from '@/lib/labels';
import { rich } from '@/lib/rich';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hasil kuis · KuisKelas' };

export default async function AttemptPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServer();
  const viewer = await getViewer();
  /* Pemilik percobaan (termasuk tamu di perangkat yang sama) atau admin; kunci sesuai pengaturan kuis */
  const { data: r, error } = await supabase.rpc('get_attempt_result', { p_attempt: params.id });
  if (error || !r) notFound();

  /* Admin: id jawaban untuk penilaian manual esai */
  let answerIds: Record<string, string> = {};
  if (viewer.isAdmin) {
    const { data } = await supabase.from('attempt_answers').select('id, question_id').eq('attempt_id', params.id);
    answerIds = Object.fromEntries((data ?? []).map((a) => [a.question_id, a.id]));
  }
  const items = (r.items ?? []) as any[];
  const pending = r.status === 'submitted';

  /* XP & lencana hanya ditampilkan ke pemilik percobaan */
  const { data: own } = viewer.user
    ? await supabase.from('quiz_attempts').select('user_id, is_preview').eq('id', params.id).maybeSingle()
    : { data: null };
  const mine = !!own && own.user_id === viewer.user?.id;
  const gains = mine && viewer.isRegistered && !own.is_preview ? await gainsFor({ attempt: params.id }) : null;

  return (
    <div className="container-wide space-y-6 py-8 sm:py-10">
      <PageHeader
        back={{ href: `/quizzes/${r.quiz_id}`, label: 'Kembali ke kuis' }}
        eyebrow="Hasil kuis"
        title={r.quiz_title}
        description={`Dikirim ${fmtDateTime(r.finished_at)}${r.late ? ' · melewati batas waktu' : ''}`}
      />

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-4">
          <div><div className="eyebrow">Skor</div><div className="font-heading text-3xl font-extrabold">{fmtNum(r.score)}<span className="text-lg text-muted-foreground"> / {fmtNum(r.max_score)}</span></div></div>
          <div><div className="eyebrow">Persentase</div><div className="font-heading text-3xl font-extrabold">{fmtNum(r.percent)}%</div></div>
          <div><div className="eyebrow">Status</div>
            <div className="mt-1">{pending ? <Badge variant="outline">Menunggu penilaian esai</Badge> : r.passed ? <Badge className="bg-success text-success-foreground">Lulus</Badge> : <Badge variant="destructive">Belum lulus</Badge>}</div>
          </div>
          <div className="flex items-end gap-2 sm:justify-end">
            <Button asChild variant="outline" size="sm"><Link href={`/quizzes/${r.quiz_id}`}>Coba lagi</Link></Button>
            {viewer.isRegistered && <Button asChild variant="ghost" size="sm"><Link href="/dashboard/history">Riwayat</Link></Button>}
          </div>
        </CardContent>
      </Card>

      {gains && (<><XpSync /><XpGainBox {...gains} /></>)}
      {mine && !viewer.isRegistered && (
        <div className="note-box flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>Kamu mengerjakan sebagai tamu, jadi hasil ini tidak menambah XP. Buat akun agar XP, level, dan lencanamu tersimpan.</span>
          <Button asChild size="sm"><Link href="/signup">Buat akun</Link></Button>
        </div>
      )}

      {!r.feedback && <p className="note-box text-sm">Pengajar tidak menampilkan kunci jawaban dan pembahasan untuk kuis ini.</p>}

      <ol className="space-y-3">
        {items.map((it, k) => {
          const q = it.question;
          const icon = it.is_correct === null ? <CircleDashed className="h-5 w-5 text-warning" /> : it.is_correct ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />;
          return (
            <li key={q.id}>
              <Card className={cn(it.is_correct === false && 'border-destructive/40', it.is_correct && 'border-success/40')}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5">{icon}</span>
                    <div className="flex-1 space-y-1">
                      <p className="eyebrow">Soal {k + 1} · {fmtNum(it.points)} / {fmtNum(it.max_points)} poin</p>
                      <Prompt html={q.prompt} className="text-base sm:text-lg" />
                    </div>
                  </div>
                  <dl className="grid gap-1 text-sm sm:grid-cols-[9rem_1fr]">
                    <dt className="font-heading font-bold text-muted-foreground">Jawabanmu</dt>
                    <dd dangerouslySetInnerHTML={{ __html: rich(describeResponse(q, it.response)) }} />
                    {it.answer && <>
                      <dt className="font-heading font-bold text-muted-foreground">Kunci</dt>
                      <dd dangerouslySetInnerHTML={{ __html: rich(describeAnswer(q, it.answer)) }} />
                    </>}
                  </dl>
                  {it.explanation && <p className="note-box text-sm" dangerouslySetInnerHTML={{ __html: rich(it.explanation) }} />}
                  {viewer.isAdmin && (q.type === 'essay' || q.type === 'short_answer') && answerIds[q.id] && (
                    <GradeAnswer answerId={answerIds[q.id]} max={Number(it.max_points)} current={Number(it.points)} />
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
