import Link from 'next/link';
import { Gamepad2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/site/page-parts';
import { QuizCard, type PublicQuiz } from '@/components/quiz/quiz-card';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kuis · Cognify' };

export default async function QuizzesPage() {
  const supabase = createSupabaseServer();
  const [{ data }, { data: courses }] = await Promise.all([
    supabase.rpc('list_public_quizzes', {}),
    supabase.rpc('arena_courses', {}),
  ]);
  const quizzes = (data as PublicQuiz[] | null) ?? [];
  return (
    <div className="container-wide space-y-10 py-10">
      <PageHeader
        title="Kuis"
        description="Main Arena melawan bot gaya Kahoot, kerjakan kuis mandiri, atau ikut kompetisi live lewat kode sesi dari pengajar."
        actions={<Button asChild variant="outline"><Link href="/join"><Radio className="mr-1 h-4 w-4" /> Gabung sesi live</Link></Button>}
      />

      {(courses ?? []).length > 0 && (
        <section className="space-y-4" aria-labelledby="arena-courses">
          <div className="space-y-1">
            <h2 id="arena-courses" className="flex items-center gap-2 text-xl"><Gamepad2 className="h-5 w-5" /> Arena per mata kuliah</h2>
            <p className="text-sm text-muted-foreground">Soal acak dari semua materi satu mata kuliah. Tidak perlu membuka materi dulu; cukup masuk dengan akunmu.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(courses ?? []).map((c, i) => (
              <Link key={c.id} href={`/arena/course/${c.slug}`}
                className={`arena-tile arena-tile-${i % 4} flex items-center justify-between gap-3 rounded-xl border-2 border-ink p-4 no-underline shadow-brutal transition-transform hover:-translate-y-0.5`}>
                <span className="space-y-0.5">
                  <span className="block font-heading text-base font-extrabold">{c.title}</span>
                  <span className="block font-heading text-xs opacity-85">{c.question_count} soal</span>
                </span>
                <span className="shrink-0 rounded-full border-2 border-current px-3 py-1 font-heading text-xs font-bold">Main</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="all-quizzes">
        <h2 id="all-quizzes" className="text-xl">Semua kuis</h2>
        {quizzes.length === 0 ? (
          <EmptyState title="Belum ada kuis" description="Kuis yang dipublikasikan pengajar akan tampil di sini." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q) => <QuizCard key={q.id} q={q} />)}
          </div>
        )}
      </section>
    </div>
  );
}
