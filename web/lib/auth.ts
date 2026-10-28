import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export type Viewer = {
  user: User | null;
  /** null untuk tamu dan pengguna anonim (tamu kuis) */
  profile: Profile | null;
  isRegistered: boolean;
  isAdmin: boolean;
};

/**
 * Siapa yang sedang membuka halaman, dibaca sekali per permintaan.
 * getUser() memvalidasi token ke Supabase Auth; jangan memakai getSession() untuk keputusan akses.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return { user, profile: null, isRegistered: false, isAdmin: false };
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  const profile = (data as Profile | null) ?? null;
  return { user, profile, isRegistered: true, isAdmin: profile?.role === 'admin' };
});

/** Untuk layout/halaman admin: tamu diarahkan ke /signin, non-admin mendapat 404. */
export async function requireAdmin(nextPath = '/admin'): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.isRegistered) redirect(`/signin?next=${encodeURIComponent(nextPath)}`);
  if (!viewer.isAdmin) notFound();
  return viewer;
}

/** Untuk halaman yang butuh akun terdaftar. */
export async function requireUser(nextPath: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.isRegistered) redirect(`/signin?next=${encodeURIComponent(nextPath)}`);
  return viewer;
}

export { safeNext } from '@/lib/safe-next';
