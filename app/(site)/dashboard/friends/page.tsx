import { FriendsPanel, type FriendsData } from '@/components/friends/friends-panel';
import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';

export const metadata = { title: 'Teman · Cognify' };

/** Teman: kode teman, permintaan pertemanan, dan papan peringkat Arena mingguan */
export default async function FriendsPage() {
  const viewer = await requireUser('/dashboard/friends');
  const { data } = await createSupabaseServer().rpc('list_friends', {});
  const name = viewer.profile?.display_name || viewer.user?.email?.split('@')[0] || 'Kamu';
  return <FriendsPanel data={(data as FriendsData | null) ?? { code: '', friends: [], incoming: [], outgoing: [], me: { week_points: 0, week_runs: 0 } }} myName={name} />;
}
