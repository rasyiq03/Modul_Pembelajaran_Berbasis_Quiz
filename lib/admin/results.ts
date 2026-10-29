import { createSupabaseServer } from '@/lib/supabase/server';

export type AttemptRow = {
  id: string; user_id: string; is_guest: boolean; nickname: string | null; status: string; score: number; max_score: number;
  percent: number; passed: boolean; late: boolean; started_at: string; finished_at: string | null; email: string | null; name: string | null;
};

/** Percobaan sebuah kuis (tanpa pratinjau admin) beserta email/nama pengguna terdaftar */
export async function quizAttempts(quizId: string, limit = 1000): Promise<AttemptRow[]> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('quiz_attempts')
    .select('id, user_id, is_guest, nickname, status, score, max_score, percent, passed, late, started_at, finished_at')
    .eq('quiz_id', quizId).eq('is_preview', false)
    .order('started_at', { ascending: false }).limit(limit);
  const rows = data ?? [];
  const ids = Array.from(new Set(rows.filter((r) => !r.is_guest).map((r) => r.user_id)));
  const { data: profs } = ids.length ? await supabase.from('profiles').select('id, email, display_name').in('id', ids) : { data: [] };
  const p = new Map((profs ?? []).map((x) => [x.id, x]));
  return rows.map((r) => ({ ...r, email: p.get(r.user_id)?.email ?? null, name: p.get(r.user_id)?.display_name ?? r.nickname }));
}
