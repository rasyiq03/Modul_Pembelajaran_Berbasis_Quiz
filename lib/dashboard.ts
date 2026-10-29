import { createSupabaseServer } from '@/lib/supabase/server';

export type MyMaterial = { id: string; created_at: string; materials: { id: string; title: string; slug: string; description: string | null; courses: { title: string; slug: string } | null } | null };
export type MyAttempt = { id: string; status: string; score: number; max_score: number; percent: number; passed: boolean; finished_at: string | null; quizzes: { id: string; title: string } | null };

export async function myMaterials(userId: string): Promise<MyMaterial[]> {
  const { data } = await createSupabaseServer()
    .from('enrollments')
    .select('id, created_at, materials(id, title, slug, description, courses(title, slug))')
    .eq('user_id', userId).eq('revoked', false).order('created_at', { ascending: false });
  return ((data ?? []) as unknown as MyMaterial[]).filter((e) => e.materials);
}

export async function myAttempts(userId: string, limit = 200): Promise<MyAttempt[]> {
  const { data } = await createSupabaseServer()
    .from('quiz_attempts')
    .select('id, status, score, max_score, percent, passed, finished_at, quizzes(id, title)')
    .eq('user_id', userId).neq('status', 'in_progress').eq('is_preview', false)
    .order('finished_at', { ascending: false }).limit(limit);
  return (data ?? []) as unknown as MyAttempt[];
}
