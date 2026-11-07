import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/site/page-parts';
import { ArenaGame } from '@/components/arena/arena-game';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Arena · Cognify' };

export default async function QuizArenaPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const viewer = await requireUser(`/arena/quiz/${params.id}`);
  const supabase = createSupabaseServer();
  const [{ data: quiz }, { data: access }] = await Promise.all([
    supabase.from('quizzes').select('id, title').eq('id', params.id).maybeSingle(),
    supabase.rpc('quiz_access', { p_quiz: params.id }),
  ]);
  if (!quiz || !access) notFound();
  const back = `/quizzes/${quiz.id}`;

  return (
    <div className="container-page space-y-4 py-8">
      <Button asChild variant="ghost" size="sm"><Link href={back}><ArrowLeft className="mr-1 h-4 w-4" /> {quiz.title}</Link></Button>
      {access.arena_count === 0 ? (
        <EmptyState title="Belum bisa dimainkan di Arena" description="Kuis ini belum punya soal pilihan tunggal atau benar/salah." />
      ) : (
        <ArenaGame target={{ quizId: quiz.id }} title={quiz.title} available={access.arena_count}
          playerName={viewer.profile?.display_name || viewer.user?.email?.split('@')[0] || 'Kamu'} backHref={back} />
      )}
    </div>
  );
}
