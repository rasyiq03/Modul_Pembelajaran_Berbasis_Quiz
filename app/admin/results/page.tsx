import Link from 'next/link';
import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, PageHeader } from '@/components/site/page-parts';
import { createSupabaseServer } from '@/lib/supabase/server';
import { quizAttempts } from '@/lib/admin/results';
import { QUESTION_TYPE_LABEL, QUIZ_MODE_LABEL, fmtDateTime, fmtNum } from '@/lib/labels';
import type { QuestionType, QuizMode } from '@/lib/database.types';
import { plain } from '@/lib/rich';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hasil & analitik · Admin' };

export default async function AdminResultsPage({ searchParams }: { searchParams: { quiz?: string } }) {
  const supabase = createSupabaseServer();
  const { data: quizzes } = await supabase.from('quizzes').select('id, title, mode').order('title');
  const quizId = searchParams.quiz ?? quizzes?.[0]?.id;
  const [{ data: stats }, attempts] = quizId
    ? await Promise.all([supabase.rpc('quiz_stats', { p_quiz: quizId }), quizAttempts(quizId, 300)])
    : [{ data: null }, []];
  const st = stats as any;

  return (
    <div className="space-y-6">
      <PageHeader title="Hasil & analitik" description="Partisipasi, skor, dan tingkat jawaban benar per soal untuk kuis mandiri. Hasil sesi live ada di konsol tiap sesi." />
      <form action="/admin/results" className="flex flex-wrap gap-2">
        <select name="quiz" defaultValue={quizId} aria-label="Pilih kuis" className="h-10 min-w-[16rem] rounded-md border-[1.5px] border-input bg-background px-3 font-heading text-sm">
          {(quizzes ?? []).map((q) => <option key={q.id} value={q.id}>{q.title} · {QUIZ_MODE_LABEL[q.mode as QuizMode]}</option>)}
        </select>
        <Button type="submit" variant="outline">Tampilkan</Button>
        {quizId && <Button asChild variant="outline"><a href={`/admin/results/export?quiz=${quizId}`}><Download className="mr-1 h-4 w-4" /> Unduh CSV</a></Button>}
      </form>

      {!quizId || !st ? <EmptyState title="Belum ada kuis" /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Percobaan', fmtNum(st.attempts, 0)], ['Selesai', fmtNum(st.finished, 0)], ['Peserta', `${fmtNum(st.participants, 0)} (${fmtNum(st.guests, 0)} tamu)`],
              ['Rata-rata skor', st.avg_percent == null ? '–' : `${fmtNum(st.avg_percent)}%`], ['Tingkat lulus', st.pass_rate == null ? '–' : `${fmtNum(st.pass_rate)}%`],
            ].map(([k, v]) => (
              <Card key={k}><CardContent className="p-4"><div className="eyebrow">{k}</div><div className="font-heading text-2xl font-extrabold">{v}</div></CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Tingkat jawaban benar per soal</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {st.questions.length === 0 && <p className="text-sm text-muted-foreground">Kuis ini belum punya soal.</p>}
              {st.questions.map((q: any, i: number) => {
                const rate = q.answered ? (q.correct / q.answered) * 100 : null;
                return (
                  <div key={q.question_id} className="grid items-center gap-2 font-heading text-sm sm:grid-cols-[2rem_1fr_12rem_6rem]">
                    <span className="font-extrabold">{i + 1}</span>
                    <Link href={`/admin/questions/${q.question_id}`} className="line-clamp-1 text-foreground">{plain(q.prompt)} <span className="text-xs text-muted-foreground">· {QUESTION_TYPE_LABEL[q.type as QuestionType]}</span></Link>
                    <span className="h-2 overflow-hidden rounded-full bg-secondary"><span className={`block h-full ${rate != null && rate < 50 ? 'bg-destructive' : 'bg-success'}`} style={{ width: `${rate ?? 0}%` }} /></span>
                    <span className="text-right">{rate == null ? '–' : `${fmtNum(rate, 0)}%`} <span className="text-xs text-muted-foreground">({q.correct}/{q.answered})</span></span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Percobaan terbaru</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Peserta</TableHead><TableHead>Status</TableHead><TableHead>Skor</TableHead><TableHead>Selesai</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {attempts.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada percobaan.</TableCell></TableRow>}
                  {attempts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.name ?? (a.is_guest ? 'Tamu' : '–')}{a.is_guest && <Badge variant="outline" className="ml-2">tamu</Badge>}<div className="text-xs text-muted-foreground">{a.email}</div></TableCell>
                      <TableCell>{a.status === 'submitted' ? <Badge variant="outline">Perlu dinilai</Badge> : a.status === 'in_progress' ? <Badge variant="secondary">Dikerjakan</Badge> : a.passed ? <Badge>Lulus</Badge> : <Badge variant="destructive">Belum lulus</Badge>}</TableCell>
                      <TableCell>{fmtNum(a.score)} / {fmtNum(a.max_score)} ({fmtNum(a.percent)}%)</TableCell>
                      <TableCell>{fmtDateTime(a.finished_at)}</TableCell>
                      <TableCell>{a.status !== 'in_progress' && <Link href={`/attempts/${a.id}`}>Detail</Link>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
