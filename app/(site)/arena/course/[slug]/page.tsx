import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ArenaGame } from '@/components/arena/arena-game';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Arena · Cognify' };

/** Arena acak: soal dari semua materi terpublikasi satu mata kuliah */
export default async function CourseArenaPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const viewer = await requireUser(`/arena/course/${params.slug}`);
  const { data } = await createSupabaseServer().rpc('arena_courses', {});
  const course = (data ?? []).find((c) => c.slug === params.slug);
  if (!course) notFound();

  return (
    <div className="container-page space-y-4 py-8">
      <Button asChild variant="ghost" size="sm"><Link href="/quizzes"><ArrowLeft className="mr-1 h-4 w-4" /> Semua kuis</Link></Button>
      <ArenaGame target={{ courseId: course.id }} title={`Arena acak · ${course.title}`} available={course.question_count}
        playerName={viewer.profile?.display_name || viewer.user?.email?.split('@')[0] || 'Kamu'} backHref={`/courses/${course.slug}`} />
    </div>
  );
}
