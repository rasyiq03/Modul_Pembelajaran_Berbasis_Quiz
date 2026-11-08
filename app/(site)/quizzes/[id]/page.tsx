import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, Crown, Gamepad2, Layers, Lock, LogIn, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { QuizPlayer } from '@/components/quiz/quiz-player';
import { getViewer } from '@/lib/auth';
import { getViewerTier } from '@/lib/subscriptions';
import { justifyViewerAccess } from '@/lib/dsl';
import { createSupabaseServer } from '@/lib/supabase/server';
import { ACCESS_LEVEL_LABEL, FEEDBACK_LABEL, QUIZ_MODE_HELP, QUIZ_MODE_LABEL, STATUS_LABEL, fmtDateTime, fmtNum, type Feedback } from '@/lib/labels';
import type { QuizMode, Status } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export default async function QuizPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createSupabaseServer();
  const [viewer, tier] = await Promise.all([getViewer(), getViewerTier()]);
  /* RLS: hanya kuis terpublikasi, kecuali admin (pratinjau draf, FR-47) */
  const [{ data: quiz }, { data: access }] = await Promise.all([
    supabase.from('quizzes').select('id, title, description, mode, settings, status').eq('id', params.id).maybeSingle(),
    supabase.rpc('quiz_access', { p_quiz: params.id }),
  ]);
  if (!quiz || !access) notFound();
  const s = (quiz.settings ?? {}) as { allow_guests?: boolean; time_limit_sec?: number; attempts_allowed?: number; show_feedback?: Feedback; pass_threshold?: number };
  const mode = quiz.mode as QuizMode;
  const arenaCount = access.arena_count;
  const quizMaterials = access.materials ?? [];
  const justif = justifyViewerAccess({
    effectiveLevel: access.level,
    tier,
    canTakeFromServer: access.can_take,
    canSeeExplanationsFromServer: access.explanations,
    allowGuests: !!s.allow_guests,
    materialTitles: quizMaterials.map((m) => m.title),
  });
  const here = `/quizzes/${quiz.id}`;

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
          {quizMaterials.length > 1 && (
            <Badge variant="outline"><Layers className="mr-1 h-3 w-3" /> Campuran {quizMaterials.length} materi</Badge>
          )}
          <Badge variant="outline">{access.level === 'public' ? null : <Lock className="mr-1 h-3 w-3" />}{ACCESS_LEVEL_LABEL[access.level]}</Badge>
          {quiz.status !== 'published' && <Badge variant="outline">{STATUS_LABEL[quiz.status as Status]}</Badge>}
        </div>
        <h1 className="text-[clamp(1.8rem,4vw,2.6rem)]">{quiz.title}</h1>
        {quiz.description && <p className="max-w-[65ch] text-lg text-muted-foreground">{quiz.description}</p>}
        {quizMaterials.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 font-heading text-xs">
            <span className="flex items-center gap-1 font-bold text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              {quizMaterials.length > 1 ? `Cakupan ${quizMaterials.length} materi:` : 'Materi terkait:'}
            </span>
            {quizMaterials.map((m) => (
              <Link
                key={`${m.course_slug}/${m.slug}`}
                href={`/courses/${m.course_slug}/${m.slug}`}
                className="rounded-md border bg-secondary/50 px-2.5 py-0.5 font-semibold no-underline hover:bg-secondary"
              >
                {m.title}
              </Link>
            ))}
          </div>
        )}
        <ul className="flex flex-wrap gap-x-5 gap-y-1 font-heading text-sm text-muted-foreground">
          <li>{QUIZ_MODE_HELP[mode]}</li>
          {s.time_limit_sec ? <li>Batas waktu {Math.round(s.time_limit_sec / 60)} menit</li> : null}
          {s.attempts_allowed ? <li>Maks. {s.attempts_allowed}× percobaan</li> : null}
          <li>Kunci jawaban: {FEEDBACK_LABEL[s.show_feedback ?? 'after_submit'].toLowerCase()}</li>
          <li>Pembahasan: {access.explanations ? 'tersedia untukmu' : 'khusus pelanggan'}</li>
          <li>Lulus ≥ {s.pass_threshold ?? 60}%</li>
        </ul>
      </header>

      {arenaCount > 0 && <ArenaCallout quizId={quiz.id} count={arenaCount} isRegistered={viewer.isRegistered} />}

      {mode === 'live_competition' ? (
        <div className="note-box space-y-3">
          <p>Kuis ini dimainkan bersama lewat sesi live. Minta kode sesi dari pengajar.</p>
          <Button asChild><Link href="/join"><Radio className="mr-1 h-4 w-4" /> Gabung sesi</Link></Button>
        </div>
      ) : !access.can_take ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="flex items-center gap-2 font-heading font-bold"><Lock className="h-4 w-4" /> {justif.quizStatusLabel}</p>
            <p className="text-muted-foreground">
              {justif.quizReason} {justif.explanationReason}
              {arenaCount > 0 && ' Sambil menunggu, kamu tetap bisa berlatih soal-soalnya di Arena.'}
            </p>
            {viewer.isRegistered
              ? <Button asChild><Link href="/dashboard/subscription"><Crown className="mr-1 h-4 w-4" /> Lihat langganan</Link></Button>
              : <Button asChild><Link href={`/signin?next=${encodeURIComponent(here)}`}><LogIn className="mr-1 h-4 w-4" /> Masuk</Link></Button>}
          </CardContent>
        </Card>
      ) : (
        <QuizPlayer quizId={quiz.id} allowGuests={access.level === 'public' && !!s.allow_guests} isRegistered={viewer.isRegistered} isPreview={quiz.status !== 'published'} />
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

/** Ajakan bermain Arena: kuis gaya Kahoot melawan bot dengan soal-soal kuis ini */
function ArenaCallout({ quizId, count, isRegistered }: { quizId: string; count: number; isRegistered: boolean }) {
  return (
    <div className="arena-stage flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-ink p-5 shadow-brutal">
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-heading text-lg font-extrabold"><Gamepad2 className="h-5 w-5" /> Arena: lawan bot gaya Kahoot</p>
        <p className="text-sm opacity-85">{count} soal pilihan ganda & benar/salah, skor dari ketepatan dan kecepatan. Tidak perlu membuka materi dulu.</p>
      </div>
      {isRegistered
        ? <Button asChild className="arena-btn"><Link href={`/arena/quiz/${quizId}`}>Main Arena</Link></Button>
        : <Button asChild className="arena-btn"><Link href={`/signin?next=${encodeURIComponent(`/arena/quiz/${quizId}`)}`}><LogIn className="mr-1 h-4 w-4" /> Masuk untuk main</Link></Button>}
    </div>
  );
}
