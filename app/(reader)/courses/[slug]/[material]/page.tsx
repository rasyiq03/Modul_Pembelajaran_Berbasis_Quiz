import { notFound } from 'next/navigation';
import { MaterialReader, type ReaderQuiz } from '@/components/materials/material-reader';
import { getMaterialBySlug, getMaterialsForCourse } from '@/lib/catalog/queries';
import { getMaterialAccess } from '@/lib/materials/access';
import { getSubscriptionState } from '@/lib/subscriptions';
import { accessLevel, canReadLevel, effectiveStatus } from '@/lib/access';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ slug: string; material: string }> }) {
  const params = await props.params;
  const { material } = await getMaterialBySlug(params.slug, params.material);
  return { title: `${material?.title ?? 'Materi'} · Cognify` };
}

/** Pembaca materi layar penuh (tanpa header & footer situs) */
export default async function MaterialReaderPage(props: { params: Promise<{ slug: string; material: string }> }) {
  const params = await props.params;
  const { course, material } = await getMaterialBySlug(params.slug, params.material);
  if (!course || !material) notFound();

  const [access, siblings, quizzes, subs] = await Promise.all([
    getMaterialAccess(material),
    getMaterialsForCourse(course.id),
    createSupabaseServer().rpc('list_public_quizzes', { p_material: material.id }).then((r) => (r.data ?? []) as unknown as ReaderQuiz[]),
    getSubscriptionState(),
  ]);
  const latest = subs.history[0];

  return (
    <MaterialReader
      course={{ slug: course.slug, title: course.title }}
      material={{
        slug: material.slug,
        title: material.title,
        description: material.description,
        objectives: (material.learning_objectives ?? '').split('\n').map((o) => o.replace(/^[-*]\s*/, '').trim()).filter(Boolean),
        tags: (material.material_tags ?? []).map((t) => t.tag),
        updatedAt: material.updated_at,
        draft: material.status !== 'published',
      }}
      access={access}
      siblings={siblings.map((s) => {
        const level = accessLevel(s.access_level);
        return { slug: s.slug, title: s.title, level, locked: !canReadLevel(level, access.tier) };
      })}
      quizzes={quizzes.map((q) => ({ id: q.id, title: q.title, mode: q.mode, question_count: q.question_count }))}
      latest={latest ? {
        status: effectiveStatus(latest), admin_note: latest.admin_note, created_at: latest.created_at,
        reviewed_at: latest.reviewed_at, expires_at: latest.expires_at,
      } : null}
    />
  );
}
