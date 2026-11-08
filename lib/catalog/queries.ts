import { cache } from 'react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { QueryFilterDSL } from '@/lib/dsl/query/filter';
import type { Database } from '@/lib/database.types';

export type CourseRow = Database['public']['Tables']['courses']['Row'];
export type MaterialRow = Database['public']['Tables']['materials']['Row'];

export type CourseWithCounts = CourseRow & { material_count: number };

export type MaterialWithCourse = MaterialRow & {
  courses: { id: string; title: string; slug: string } | null;
  material_tags: { tag: string }[];
};

export async function getPublishedCourses(): Promise<CourseWithCounts[]> {
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .from('courses')
      .select('id, title, slug, description, cover_url, status, display_order, created_at, updated_at, materials(count)')
      .eq('status', 'published')
      .order('display_order', { ascending: true });

    if (!data) return [];
    return (data as unknown as Array<CourseRow & { materials: { count: number }[] }>).map((c) => ({
      ...c,
      material_count: c.materials?.[0]?.count ?? 0,
    })) as CourseWithCounts[];
  } catch {
    return [];
  }
}

/* cache(): generateMetadata dan halaman memakai hasil yang sama dalam satu permintaan */
export const getCourseBySlug = cache(async (slug: string): Promise<CourseRow | null> => {
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    return (data as unknown as CourseRow) ?? null;
  } catch {
    return null;
  }
});

export async function getMaterialsForCourse(courseId: string): Promise<MaterialWithCourse[]> {
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .from('materials')
      .select('*, courses(id, title, slug), material_tags(tag)')
      .eq('course_id', courseId)
      .eq('status', 'published')
      .order('display_order', { ascending: true });
    return ((data as unknown as MaterialWithCourse[]) ?? []) as MaterialWithCourse[];
  } catch {
    return [];
  }
}

export async function getRecentMaterials(limit = 6): Promise<MaterialWithCourse[]> {
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .from('materials')
      .select('*, courses(id, title, slug), material_tags(tag)')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(limit);
    return ((data as unknown as MaterialWithCourse[]) ?? []) as MaterialWithCourse[];
  } catch {
    return [];
  }
}

export async function searchPublishedMaterials(opts: {
  q?: string;
  courseId?: string;
  sort?: 'newest' | 'title';
  page?: number;
  pageSize?: number;
}): Promise<{ items: MaterialWithCourse[]; total: number }> {
  const supabase = createSupabaseServer();
  const { from, to } = QueryFilterDSL.paginate(opts, 12);

  let query = supabase
    .from('materials')
    .select('*, courses(id, title, slug), material_tags(tag)', { count: 'exact' })
    .eq('status', 'published');

  const filter = QueryFilterDSL.orIlike(['title', 'description'], opts.q);
  if (filter) query = query.or(filter);
  if (opts.courseId) query = query.eq('course_id', opts.courseId);
  query = opts.sort === 'title' ? query.order('title', { ascending: true }) : query.order('updated_at', { ascending: false });
  query = query.range(from, to);

  const { data, count } = await query;
  return { items: ((data as unknown as MaterialWithCourse[]) ?? []) as MaterialWithCourse[], total: count ?? 0 };
}

export const getMaterialBySlug = cache(async (courseSlug: string, materialSlug: string) => {
  const supabase = createSupabaseServer();
  const { data: course } = await supabase
    .from('courses')
    .select('id, title, slug')
    .eq('slug', courseSlug)
    .maybeSingle();
  const courseRow = (course as unknown as { id: string; title: string; slug: string } | null) ?? null;
  if (!courseRow) return { course: null, material: null };

  const { data: material } = await supabase
    .from('materials')
    .select('*, courses(id, title, slug), material_tags(tag)')
    .eq('course_id', courseRow.id)
    .eq('slug', materialSlug)
    .maybeSingle();

  return { course: courseRow, material: ((material as unknown as MaterialWithCourse) ?? null) as MaterialWithCourse | null };
});

export async function getPublishedQuizzes() {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('quizzes')
    .select('id, title, description, mode, status, updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });
  return (data as unknown as { id: string; title: string; description: string | null; mode: string; status: string; updated_at: string }[]) ?? [];
}
