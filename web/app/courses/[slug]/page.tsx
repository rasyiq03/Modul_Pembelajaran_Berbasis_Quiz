import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/site/page-parts';
import { getCourseBySlug, getMaterialsForCourse } from '@/lib/catalog/queries';

export const revalidate = 60;

export default async function CourseDetailPage({ params }: { params: { slug: string } }) {
  const course = await getCourseBySlug(params.slug);
  if (!course) notFound();
  const materials = await getMaterialsForCourse(course.id);

  return (
    <div className="container-page py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/courses"><ArrowLeft className="mr-1 h-4 w-4" /> All courses</Link>
      </Button>
      <div className="space-y-2 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{course.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{course.description}</p>
      </div>

      <h2 className="mb-3 text-xl font-semibold">Materials</h2>
      {materials.length === 0 ? (
        <EmptyState title="No materials published yet" description="Check back later, or ask your instructor." icon={<BookOpen className="h-8 w-8" />} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => (
            <Card key={m.id} className="group flex flex-col hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base group-hover:text-primary">{m.title}</CardTitle>
                  <Badge variant="outline">{m.display_order}</Badge>
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
              <CardFooter className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> Enrollment required for full content
                </span>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/courses/${course.slug}/${m.slug}`}>Open <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}