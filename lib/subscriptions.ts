import { cache } from 'react';
import { getViewer } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { effectiveStatus, type Subscription, type ViewerTier } from '@/lib/access';

export type SubscriptionState = {
  /** Langganan yang sedang berlaku */
  active: Subscription | null;
  /** Pengajuan yang menunggu persetujuan admin */
  pending: Subscription | null;
  /** Semua pengajuan, terbaru dulu */
  history: Subscription[];
};

/** Langganan milik pengguna yang sedang login (RLS: hanya barisnya sendiri), sekali per permintaan */
export const getSubscriptionState = cache(async (): Promise<SubscriptionState> => {
  const viewer = await getViewer();
  if (!viewer.isRegistered) return { active: null, pending: null, history: [] };
  const { data } = await createSupabaseServer()
    .from('subscriptions')
    .select('*')
    .eq('user_id', viewer.user!.id)
    .order('created_at', { ascending: false });
  const history = (data ?? []) as Subscription[];
  return {
    active: history.find((s) => effectiveStatus(s) === 'active') ?? null,
    pending: history.find((s) => s.status === 'pending') ?? null,
    history,
  };
});

export async function getViewerTier(): Promise<ViewerTier> {
  const viewer = await getViewer();
  if (viewer.isAdmin) return 'admin';
  if (!viewer.isRegistered) return 'guest';
  return (await getSubscriptionState()).active ? 'subscriber' : 'member';
}
