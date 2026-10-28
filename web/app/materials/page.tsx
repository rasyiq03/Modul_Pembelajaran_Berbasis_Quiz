import Link from 'next/link';
import { ArrowRight, BookOpen, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/site/page-parts';
import { getPublishedCourses, searchPublishedMaterials } from '@/lib/catalog/queries';
import { MaterialsFilters } from '@/components/materials/materials-filters';

export const revalidate = 0;

export const metadata = { title: 'Materials · KuisKelas' };

export default async function MaterialsPage({ searchParams }: { searchParams: { q?: string; courseId?: string; sort?: string; page?: string } }) {
  const page = Number(searchParams.page || 1);
  const [courses, { items, total }] = await Promise.all([
    getPublishedCourses(),
    searchPublishedMaterials({
      q: searchParams.q,
      courseId: searchParams.courseId,
      sort: (searchParams.sort as 'newest' | 'title') || 'newest',
      page,
      pageSize: 12,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="container-page py-10">
      <div className="space-y-2 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Material library</h1>
        <p className="text-sm text-muted-foreground">
          Previews are public. Full content unlocks per-material with an enrollment key.
        </p>
      </div>

      <MaterialsFilters courses={courses.map((c) => ({ id: c.id, title: c.title }))} />

      <p className="mt-4 text-xs text-muted-foreground">{total} materials</p>

      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No materials match your search"
            description="Try clearing filters or searching for a different term."
            icon={<BookOpen className="h-8 w-8" />}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <Card key={m.id} className="group flex flex-col hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base group-hover:text-primary">{m.title}</CardTitle>
                  {m.courses && <Badge variant="outline">{m.courses.slug.toUpperCase()}</Badge>}
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
                  <Lock className="h-3 w-3" /> Preview available
                </span>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/courses/${m.courses?.slug}/${m.slug}`}>
                    View <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            const next = new URLSearchParams(searchParams as Record<string, string>);
            next.set('page', String(p));
            return (
              <Button asChild key={p} variant={p === page ? 'default' : 'outline'} size="sm">
                <Link href={`/materials?${next.toString()}`}>{p}</Link>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}