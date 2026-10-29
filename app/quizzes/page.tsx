import Link from 'next/link';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/site/page-parts';
import { QuizCard, type PublicQuiz } from '@/components/quiz/quiz-card';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kuis · KuisKelas' };

export default async function QuizzesPage() {
  const { data } = await createSupabaseServer().rpc('list_public_quizzes', {});
  const quizzes = (data as PublicQuiz[] | null) ?? [];
  return (
    <div className="container-wide space-y-8 py-10">
      <PageHeader
        title="Kuis"
        description="Kuis mandiri bisa dikerjakan kapan saja. Kompetisi live diikuti lewat kode sesi dari pengajar."
        actions={<Button asChild variant="outline"><Link href="/join"><Radio className="mr-1 h-4 w-4" /> Gabung sesi live</Link></Button>}
      />
      {quizzes.length === 0 ? (
        <EmptyState title="Belum ada kuis" description="Kuis yang dipublikasikan pengajar akan tampil di sini." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q) => <QuizCard key={q.id} q={q} />)}
        </div>
      )}
    </div>
  );
}
