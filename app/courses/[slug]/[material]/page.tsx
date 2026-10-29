import { notFound } from 'next/navigation';
import { BookOpen, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMaterialBySlug } from '@/lib/catalog/queries';
import { getMaterialAccess } from '@/lib/materials/access';
import { PageHeader, SectionHeader } from '@/components/site/page-parts';
import { MaterialAccess } from '@/components/materials/material-access';
import { QuizCard, type PublicQuiz } from '@/components/quiz/quiz-card';
import { createSupabaseServer } from '@/lib/supabase/server';
import { STATUS_LABEL, fmtDate } from '@/lib/labels';
import { getViewer } from '@/lib/auth';
import { MaterialProgressCard, MaterialProgressProvider } from '@/components/materials/material-progress';

export const revalidate = 0;

export default async function MaterialDetailPage({
  params,
}: {
  params: { slug: string; material: string };
}) {
  const { course, material } = await getMaterialBySlug(params.slug, params.material);
  if (!course || !material) notFound();

  const supabase = createSupabaseServer();
  const [access, quizzes, viewer] = await Promise.all([
    getMaterialAccess(material),
    supabase.rpc('list_public_quizzes', { p_material: material.id }).then((r) => (r.data ?? []) as unknown as PublicQuiz[]),
    getViewer(),
  ]);
  /* Gamifikasi materi: bab & lab yang sudah ditandai (hanya saat membaca materi lengkap) */
  const full = access.showing === 'full';
  const earn = full && viewer.isRegistered;
  const { data: prog } = earn
    ? await supabase.from('material_progress').select('kind, ref').eq('material_id', material.id).eq('user_id', viewer.user!.id)
    : { data: [] as { kind: 'read' | 'lab'; ref: string }[] };
  const done = { read: (prog ?? []).filter((p) => p.kind === 'read').map((p) => p.ref), lab: (prog ?? []).filter((p) => p.kind === 'lab').map((p) => p.ref) };
  const sections = (material.sections ?? []) as { id: string; label: string }[];
  const labs = (material.labs ?? []) as { id: string; label: string }[];

  return (
    <MaterialProgressProvider materialId={material.id} sections={full ? sections : []} labs={full ? labs : []} initial={done} earn={earn}>
    <div className="container-wide space-y-6 py-8 sm:py-10">
      <PageHeader
        back={{ href: `/courses/${course.slug}`, label: course.title }}
        eyebrow="Materi"
        title={material.title}
        description={material.description}
        meta={material.material_tags?.length ? material.material_tags.map((t) => (
          <Badge key={t.tag} variant="secondary" className="text-xs">{t.tag}</Badge>
        )) : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">

          <MaterialAccess
            materialSlug={material.slug}
            courseSlug={course.slug}
            readerSrc={access.readerSrc}
            showing={access.showing}
            hasAccess={access.hasAccess}
            accessReason={access.reason}
            isRegistered={access.isRegistered}
          />

          {quizzes.length > 0 && (
            <section className="space-y-3">
              <SectionHeader title="Kuis untuk materi ini" />
              <div className="grid gap-4 sm:grid-cols-2">
                {quizzes.map((q) => <QuizCard key={q.id} q={q} />)}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <MaterialProgressCard />
          {!(full && sections.length) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Tujuan pembelajaran</CardTitle>
            </CardHeader>
            <CardContent>
              {material.learning_objectives ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {material.learning_objectives.split('\n').filter(Boolean).map((o, i) => (
                    <li key={i}>{o.replace(/^[-*]\s*/, '')}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada tujuan pembelajaran untuk materi ini.</p>
              )}
            </CardContent>
          </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" /> Tentang materi</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Mata kuliah: <span className="text-foreground">{course.title}</span></p>
              <div>Status: <Badge variant="secondary">{STATUS_LABEL[material.status as keyof typeof STATUS_LABEL] ?? material.status}</Badge></div>
              <p>Diperbarui: {fmtDate(material.updated_at)}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
    </MaterialProgressProvider>
  );
}