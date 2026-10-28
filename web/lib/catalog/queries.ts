import { createSupabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

export type CourseRow = Database['public']['Tables']['courses']['Row'];
export type MaterialRow = Database['public']['Tables']['materials']['Row'];

export type CourseWithCounts = CourseRow & { material_count: number };

export type MaterialWithCourse = MaterialRow & {
  courses: { id: string; title: string; slug: string } | null;
  material_tags: { tag: string }[];
};

export async function getPublishedCourses(): Promise<CourseWithCounts[]> {
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
}

export async function getCourseBySlug(slug: string): Promise<CourseRow | null> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return (data as unknown as CourseRow) ?? null;
}

export async function getMaterialsForCourse(courseId: string): Promise<MaterialWithCourse[]> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('materials')
    .select('*, courses(id, title, slug), material_tags(tag)')
    .eq('course_id', courseId)
    .eq('status', 'published')
    .order('display_order', { ascending: true });
  return ((data as unknown as MaterialWithCourse[]) ?? []) as MaterialWithCourse[];
}

export async function getRecentMaterials(limit = 6): Promise<MaterialWithCourse[]> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('materials')
    .select('*, courses(id, title, slug), material_tags(tag)')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(limit);
  return ((data as unknown as MaterialWithCourse[]) ?? []) as MaterialWithCourse[];
}

export async function searchPublishedMaterials(opts: {
  q?: string;
  courseId?: string;
  sort?: 'newest' | 'title';
  page?: number;
  pageSize?: number;
}): Promise<{ items: MaterialWithCourse[]; total: number }> {
  const supabase = createSupabaseServer();
  const pageSize = opts.pageSize ?? 12;
  const page = opts.page ?? 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('materials')
    .select('*, courses(id, title, slug), material_tags(tag)', { count: 'exact' })
    .eq('status', 'published');

  if (opts.q) query = query.or(`title.ilike.%${opts.q}%,description.ilike.%${opts.q}%`);
  if (opts.courseId) query = query.eq('course_id', opts.courseId);
  query = opts.sort === 'title' ? query.order('title', { ascending: true }) : query.order('updated_at', { ascending: false });
  query = query.range(from, to);

  const { data, count } = await query;
  return { items: ((data as unknown as MaterialWithCourse[]) ?? []) as MaterialWithCourse[], total: count ?? 0 };
}

export async function getMaterialBySlug(courseSlug: string, materialSlug: string) {
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
}

export async function getPublishedQuizzes() {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('quizzes')
    .select('id, title, description, mode, status, updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });
  return (data as unknown as { id: string; title: string; description: string | null; mode: string; status: string; updated_at: string }[]) ?? [];
}
