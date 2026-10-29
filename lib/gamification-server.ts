import { createSupabaseServer } from '@/lib/supabase/server';
import type { MyProgress } from '@/lib/gamification';

export async function getMyProgress(): Promise<MyProgress | null> {
  const { data } = await createSupabaseServer().rpc('get_my_progress');
  return (data as MyProgress | null) ?? null;
}

/** XP & lencana yang didapat dari satu sumber (percobaan kuis atau sesi live) */
export async function gainsFor(source: { attempt: string } | { session: string }) {
  const supabase = createSupabaseServer();
  const [k, v] = Object.entries(source)[0];
  const [{ data: events }, { data: badges }, progress] = await Promise.all([
    supabase.from('xp_events').select('label, amount').eq(`meta->>${k}`, v).order('id'),
    supabase.from('user_badges').select('badge').eq('source', `${k}:${v}`),
    getMyProgress(),
  ]);
  return { events: events ?? [], badges: (badges ?? []).map((b) => b.badge), total: Number(progress?.xp ?? 0) };
}
