import Link from 'next/link';
import { Hourglass, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubscriptionRequestForm } from '@/components/subscription/request-form';
import { fmtDate } from '@/lib/labels';
import type { EffectiveStatus, ViewerTier } from '@/lib/access';
import type { AccessLevel } from '@/lib/database.types';

export type LatestSubscription = {
  status: EffectiveStatus; admin_note: string | null; created_at: string; reviewed_at: string | null; expires_at: string | null;
};

/**
 * Langkah berikutnya untuk membuka materi lengkap: masuk/daftar (tamu), atau ajukan langganan dan
 * pantau statusnya (pengguna terdaftar pada materi berlevel langganan).
 */
export function AccessPanel({ level, tier, here, latest }: {
  level: AccessLevel; tier: ViewerTier; here: string; latest: LatestSubscription | null;
}) {
  if (tier === 'guest') {
    const next = encodeURIComponent(here);
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {level === 'member'
            ? 'Materi ini terbuka untuk semua pengguna terdaftar. Masuk atau buat akun gratis untuk membacanya.'
            : 'Materi lengkap khusus pelanggan. Masuk atau buat akun, lalu ajukan langganan ke admin. Satu langganan membuka semua materi berlabel Langganan.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href={`/signin?next=${next}`}><LogIn className="mr-1.5 h-4 w-4" /> Masuk</Link></Button>
          <Button asChild variant="outline"><Link href={`/signup?next=${next}`}><UserPlus className="mr-1.5 h-4 w-4" /> Buat akun</Link></Button>
        </div>
      </div>
    );
  }

  if (latest?.status === 'pending') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-md bg-secondary p-3 font-heading text-sm">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>Pengajuan langgananmu (dikirim {fmtDate(latest.created_at)}) sedang ditinjau admin. Materi ini terbuka otomatis setelah disetujui.</span>
        </div>
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/subscription">Lihat status langganan</Link></Button>
      </div>
    );
  }

  const previous =
    latest?.status === 'rejected' ? `Pengajuan terakhirmu ditolak${latest.admin_note ? `: "${latest.admin_note}"` : '.'}` :
    latest?.status === 'revoked' ? `Langgananmu dicabut admin${latest.admin_note ? `: "${latest.admin_note}"` : '.'}` :
    latest?.status === 'expired' ? `Langgananmu berakhir ${fmtDate(latest.expires_at)}. Ajukan lagi untuk memperpanjang.` : null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Materi lengkap khusus pelanggan. Ajukan langganan ke admin; satu langganan membuka semua materi berlabel Langganan.
      </p>
      {previous && <p className="note-box-warn font-heading text-sm">{previous}</p>}
      <SubscriptionRequestForm />
    </div>
  );
}
