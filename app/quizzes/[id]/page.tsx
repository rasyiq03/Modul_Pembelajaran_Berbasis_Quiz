import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QuizPlayer } from '@/components/quiz/quiz-player';
import { getViewer } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { FEEDBACK_LABEL, QUIZ_MODE_HELP, QUIZ_MODE_LABEL, STATUS_LABEL, fmtDateTime, fmtNum, type Feedback } from '@/lib/labels';
import type { QuizMode, Status } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export default async function QuizPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServer();
  const viewer = await getViewer();
  /* RLS: hanya kuis terpublikasi, kecuali admin (pratinjau draf, FR-47) */
  const { data: quiz } = await supabase.from('quizzes').select('id, title, description, mode, settings, status').eq('id', params.id).maybeSingle();
  if (!quiz) notFound();
  const s = (quiz.settings ?? {}) as { allow_guests?: boolean; time_limit_sec?: number; attempts_allowed?: number; show_feedback?: Feedback; pass_threshold?: number };
  const mode = quiz.mode as QuizMode;

  const { data: past } = viewer.user
    ? await supabase.from('quiz_attempts').select('id, status, percent, finished_at').eq('quiz_id', quiz.id).eq('user_id', viewer.user.id)
        .neq('status', 'in_progress').order('started_at', { ascending: false }).limit(5)
    : { data: null };

  return (
    <div className="container-page space-y-6 py-10">
      <Button asChild variant="ghost" size="sm"><Link href="/quizzes"><ArrowLeft className="mr-1 h-4 w-4" /> Semua kuis</Link></Button>
      <header className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{QUIZ_MODE_LABEL[mode]}</Badge>
          {quiz.status !== 'published' && <Badge variant="outline">{STATUS_LABEL[quiz.status as Status]}</Badge>}
        </div>
        <h1 className="text-[clamp(1.8rem,4vw,2.6rem)]">{quiz.title}</h1>
        {quiz.description && <p className="max-w-[65ch] text-lg text-muted-foreground">{quiz.description}</p>}
        <ul className="flex flex-wrap gap-x-5 gap-y-1 font-heading text-sm text-muted-foreground">
          <li>{QUIZ_MODE_HELP[mode]}</li>
          {s.time_limit_sec ? <li>Batas waktu {Math.round(s.time_limit_sec / 60)} menit</li> : null}
          {s.attempts_allowed ? <li>Maks. {s.attempts_allowed}× percobaan</li> : null}
          <li>Pembahasan: {FEEDBACK_LABEL[s.show_feedback ?? 'after_submit'].toLowerCase()}</li>
          <li>Lulus ≥ {s.pass_threshold ?? 60}%</li>
        </ul>
      </header>

      {mode === 'live_competition' ? (
        <div className="note-box space-y-3">
          <p>Kuis ini dimainkan bersama lewat sesi live. Minta kode sesi dari pengajar.</p>
          <Button asChild><Link href="/join"><Radio className="mr-1 h-4 w-4" /> Gabung sesi</Link></Button>
        </div>
      ) : (
        <QuizPlayer quizId={quiz.id} allowGuests={!!s.allow_guests} isRegistered={viewer.isRegistered} isPreview={quiz.status !== 'published'} />
      )}

      {past && past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg">Percobaanmu sebelumnya</h2>
          <ul className="divide-y rounded-lg border-[1.5px] bg-card font-heading text-sm">
            {past.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>{fmtDateTime(a.finished_at)}</span>
                <span className="font-bold">{a.status === 'submitted' ? 'Menunggu penilaian' : `${fmtNum(a.percent)}%`}</span>
                <Link href={`/attempts/${a.id}`}>Lihat hasil</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
