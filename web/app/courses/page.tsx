import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/site/page-parts';
import { getPublishedCourses } from '@/lib/catalog/queries';

export const revalidate = 60;

export const metadata = { title: 'Courses · KuisKelas' };

export default async function CoursesPage() {
  const courses = await getPublishedCourses();
  return (
    <div className="container-page py-10">
      <div className="space-y-2 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Course catalog</h1>
        <p className="text-sm text-muted-foreground">
          Browse published courses. Each course contains multiple interactive lecture materials.
        </p>
      </div>
      {courses.length === 0 ? (
        <EmptyState
          title="No courses published yet"
          description="Once an administrator publishes courses they will appear here."
          icon={<BookOpen className="h-8 w-8" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Card key={c.id} className="group flex flex-col hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg group-hover:text-primary">{c.title}</CardTitle>
                  <Badge variant="secondary">{c.material_count} materials</Badge>
                </div>
                <CardDescription className="line-clamp-4 min-h-[5rem]">{c.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1" />
              <CardFooter>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/courses/${c.slug}`}>View course <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}