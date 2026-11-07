import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Gamepad2, Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/site/page-parts';
import { getCourseBySlug, getMaterialsForCourse } from '@/lib/catalog/queries';
import { getViewerTier } from '@/lib/subscriptions';
import { accessLevel, canReadLevel } from '@/lib/access';
import { ACCESS_LEVEL_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const course = await getCourseBySlug(params.slug);
  return { title: `${course?.title ?? 'Mata kuliah'} · Cognify` };
}

export default async function CourseDetailPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const course = await getCourseBySlug(params.slug);
  if (!course) notFound();
  const [materials, tier] = await Promise.all([getMaterialsForCourse(course.id), getViewerTier()]);
  const lockedCount = materials.filter((m) => !canReadLevel(accessLevel(m.access_level), tier)).length;

  return (
    <div className="container-page py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/courses"><ArrowLeft className="mr-1 h-4 w-4" /> Semua mata kuliah</Link>
      </Button>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">{course.title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{course.description}</p>
        </div>
        {materials.length > 0 && (
          <Button asChild className="arena-btn shrink-0"><Link href={`/arena/course/${course.slug}`}><Gamepad2 className="mr-1 h-4 w-4" /> Arena acak</Link></Button>
        )}
      </div>

      {lockedCount > 0 && tier !== 'admin' && (
        <div className="note-box mb-6 flex flex-col gap-3 font-heading text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            {tier === 'guest'
              ? `${lockedCount} materi baru terbuka penuh setelah kamu masuk${materials.some((m) => accessLevel(m.access_level) === 'subscriber') ? ' dan berlangganan' : ''}. Pratinjaunya tetap bisa dibaca.`
              : `${lockedCount} materi khusus pelanggan. Satu langganan membuka semuanya; pratinjaunya tetap bisa dibaca.`}
          </span>
          <Button asChild size="sm" className="shrink-0">
            {tier === 'guest'
              ? <Link href={`/signin?next=${encodeURIComponent(`/courses/${course.slug}`)}`}>Masuk</Link>
              : <Link href="/dashboard/subscription">Ajukan langganan</Link>}
          </Button>
        </div>
      )}

      <h2 className="mb-3 text-xl font-bold">Materi</h2>
      {materials.length === 0 ? (
        <EmptyState title="Belum ada materi" description="Coba lagi nanti, atau tanyakan pada pengajar." icon={<BookOpen className="h-8 w-8" />} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m, i) => {
            const level = accessLevel(m.access_level);
            const open = canReadLevel(level, tier);
            return (
              <Card key={m.id} className="group flex flex-col transition-colors hover:border-primary">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base group-hover:text-primary">
                      <Link href={`/courses/${course.slug}/${m.slug}`} className="text-inherit no-underline">{m.title}</Link>
                    </CardTitle>
                    <Badge variant="outline" className="shrink-0 tabular-nums">{i + 1}</Badge>
                  </div>
                  <CardDescription className="line-clamp-3">{m.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex flex-wrap gap-1">
                    {m.material_tags?.slice(0, 5).map((t) => (
                      <Badge key={t.tag} variant="secondary" className="text-xs">{t.tag}</Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 font-heading text-xs font-bold ${open ? 'text-success' : 'text-muted-foreground'}`}>
                    {open ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {ACCESS_LEVEL_LABEL[level]}{open ? '' : ' · pratinjau'}
                  </span>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/courses/${course.slug}/${m.slug}`}>Baca <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
