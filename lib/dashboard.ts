import { createSupabaseServer } from '@/lib/supabase/server';

export type MyAttempt = { id: string; status: string; score: number; max_score: number; percent: number; passed: boolean; finished_at: string | null; quizzes: { id: string; title: string } | null };

export async function myAttempts(userId: string, limit = 200): Promise<MyAttempt[]> {
  const { data } = await createSupabaseServer()
    .from('quiz_attempts')
    .select('id, status, score, max_score, percent, passed, finished_at, quizzes(id, title)')
    .eq('user_id', userId).neq('status', 'in_progress').eq('is_preview', false)
    .order('finished_at', { ascending: false }).limit(limit);
  return (data ?? []) as unknown as MyAttempt[];
}

export type MyArenaRun = {
  id: string; score: number; correct: number; best_streak: number; question_order: string[]; finished_at: string | null;
  quizzes: { id: string; title: string } | null; courses: { slug: string; title: string } | null;
};

/** Permainan Arena yang sudah selesai (tanpa pratinjau admin) */
export async function myArenaRuns(userId: string, limit = 200): Promise<MyArenaRun[]> {
  const { data } = await createSupabaseServer()
    .from('arena_runs')
    .select('id, score, correct, best_streak, question_order, finished_at, quizzes(id, title), courses(slug, title)')
    .eq('user_id', userId).eq('status', 'finished').eq('is_preview', false)
    .order('finished_at', { ascending: false }).limit(limit);
  return (data ?? []) as unknown as MyArenaRun[];
}
