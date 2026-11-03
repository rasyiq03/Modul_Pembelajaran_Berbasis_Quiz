import type { AccessLevel, Database } from '@/lib/database.types';

/* Aturan akses untuk TAMPILAN (ikon gembok, ajakan berlangganan). Keputusan sebenarnya diambil di
   database oleh can_read_material(); fungsi di sini hanya mencerminkannya agar UI konsisten. */

export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type ViewerTier = 'guest' | 'member' | 'subscriber' | 'admin';
export type EffectiveStatus = Subscription['status'] | 'expired';

/** Nilai tak dikenal (mis. kolom belum ada sebelum migrasi 0500) dianggap paling ketat */
export const accessLevel = (v: unknown): AccessLevel => (v === 'public' || v === 'member' ? v : 'subscriber');

/** "active" yang masa berlakunya sudah lewat ditampilkan sebagai kedaluwarsa */
export function effectiveStatus(s: Pick<Subscription, 'status' | 'expires_at'>, now = Date.now()): EffectiveStatus {
  return s.status === 'active' && s.expires_at && new Date(s.expires_at).getTime() <= now ? 'expired' : s.status;
}

export function canReadLevel(level: AccessLevel, tier: ViewerTier): boolean {
  if (tier === 'admin' || level === 'public') return true;
  if (level === 'member') return tier !== 'guest';
  return tier === 'subscriber';
}

/** Sisa hari sampai langganan berakhir (null = tanpa batas waktu) */
export function daysLeft(expiresAt: string | null, now = Date.now()): number | null {
  return expiresAt ? Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000) : null;
}
