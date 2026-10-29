import { createSupabaseServer } from '@/lib/supabase/server';

/** Semua materi (untuk pemilih materi di editor admin), berurutan per mata kuliah */
export async function materialOptions() {
  const { data } = await createSupabaseServer()
    .from('materials')
    .select('id, title, slug, display_order, courses(title, slug, display_order)')
    .neq('status', 'archived');
  const rows = (data ?? []) as unknown as { id: string; title: string; slug: string; display_order: number; courses: { title: string; slug: string; display_order: number } | null }[];
  return rows
    .sort((a, b) => (a.courses?.display_order ?? 0) - (b.courses?.display_order ?? 0) || a.display_order - b.display_order || a.title.localeCompare(b.title))
    .map((m) => ({ id: m.id, title: m.title, course: m.courses?.title ?? '', ref: `${m.courses?.slug}/${m.slug}` }));
}
