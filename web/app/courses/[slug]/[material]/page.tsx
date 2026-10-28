import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMaterialBySlug } from '@/lib/catalog/queries';
import { getMaterialAccess } from '@/lib/materials/access';
import { MaterialAccess } from '@/components/materials/material-access';

export const revalidate = 0;

export default async function MaterialDetailPage({
  params,
}: {
  params: { slug: string; material: string };
}) {
  const { course, material } = await getMaterialBySlug(params.slug, params.material);
  if (!course || !material) notFound();

  const access = await getMaterialAccess(material);

  return (
    <div className="container-page py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href={`/courses/${course.slug}`}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {course.title}
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{course.slug.toUpperCase()}</Badge>
              {material.material_tags?.map((t) => (
                <Badge key={t.tag} variant="secondary" className="text-xs">{t.tag}</Badge>
              ))}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{material.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{material.description}</p>
          </div>

          <MaterialAccess
            materialSlug={material.slug}
            courseSlug={course.slug}
            readerSrc={access.readerSrc}
            showing={access.showing}
            hasAccess={access.hasAccess}
            accessReason={access.reason}
            isRegistered={access.isRegistered}
          />
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Learning objectives</CardTitle>
            </CardHeader>
            <CardContent>
              {material.learning_objectives ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {material.learning_objectives.split('\n').filter(Boolean).map((o, i) => (
                    <li key={i}>{o.replace(/^[-*]\s*/, '')}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No learning objectives recorded for this material.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" /> About this material</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Course: <span className="text-foreground">{course.title}</span></p>
              <div>Status: <Badge variant="secondary">{material.status}</Badge></div>
              <p>Updated: {new Date(material.updated_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}