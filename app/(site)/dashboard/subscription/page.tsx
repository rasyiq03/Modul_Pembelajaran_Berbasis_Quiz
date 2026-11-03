import Link from 'next/link';
import { BadgeCheck, Crown, Globe, Hourglass, LogIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SubscriptionRequestForm } from '@/components/subscription/request-form';
import { CancelSubscriptionRequest } from '@/components/subscription/cancel-request';
import { getSubscriptionState } from '@/lib/subscriptions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { accessLevel, daysLeft, effectiveStatus } from '@/lib/access';
import { ACCESS_LEVEL_HELP, ACCESS_LEVEL_LABEL, ACCESS_LEVELS, SUBSCRIPTION_STATUS_LABEL, fmtDate } from '@/lib/labels';
import type { AccessLevel } from '@/lib/database.types';
import { requireUser } from '@/lib/auth';

export const metadata = { title: 'Langganan · StudyStudio' };

const LEVEL_ICON = { public: Globe, member: LogIn, subscriber: Crown } as const;

/** Status langganan, pengajuan/perpanjangan, dan riwayatnya */
export default async function SubscriptionPage() {
  await requireUser('/dashboard/subscription');
  const [{ active, pending, history }, { data }] = await Promise.all([
    getSubscriptionState(),
    createSupabaseServer().from('materials').select('access_level').eq('status', 'published'),
  ]);
  const counts = { public: 0, member: 0, subscriber: 0 } as Record<AccessLevel, number>;
  for (const m of data ?? []) counts[accessLevel((m as { access_level: unknown }).access_level)]++;

  const left = active ? daysLeft(active.expires_at) : null;
  const renewSoon = !!active && left != null && left <= 30;
  const latest = history[0];
  const previous =
    !active && latest?.status === 'rejected' ? `Pengajuan terakhirmu ditolak${latest.admin_note ? `: "${latest.admin_note}"` : '.'}` :
    !active && latest?.status === 'revoked' ? `Langgananmu dicabut admin${latest.admin_note ? `: "${latest.admin_note}"` : '.'}` :
    !active && latest && effectiveStatus(latest) === 'expired' ? `Langgananmu berakhir ${fmtDate(latest.expires_at)}.` : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {active ? <BadgeCheck className="h-5 w-5 text-success" /> : pending ? <Hourglass className="h-5 w-5 text-primary" /> : <Crown className="h-5 w-5 text-primary" />}
              {active ? 'Langganan aktif' : pending ? 'Menunggu persetujuan admin' : 'Belum berlangganan'}
            </CardTitle>
            <CardDescription>
              {active
                ? active.expires_at
                  ? `Berlaku hingga ${fmtDate(active.expires_at)} (${left} hari lagi). Semua materi berlabel Langganan terbuka penuh.`
                  : 'Berlaku tanpa batas waktu. Semua materi berlabel Langganan terbuka penuh.'
                : pending
                  ? `Diajukan ${fmtDate(pending.created_at)}. Materi langganan terbuka otomatis setelah admin menyetujuinya.`
                  : 'Satu langganan membuka semua materi berlabel Langganan. Ajukan ke admin; kamu akan melihat statusnya di sini.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pending && (
              <div className="space-y-3">
                {pending.message && <p className="note-box text-sm">Pesanmu: {pending.message}</p>}
                <CancelSubscriptionRequest />
              </div>
            )}
            {!pending && active && renewSoon && (
              <>
                <p className="note-box-warn font-heading text-sm">Masa berlaku hampir habis. Ajukan perpanjangan agar akses tidak terputus.</p>
                <SubscriptionRequestForm submitLabel="Ajukan perpanjangan" />
              </>
            )}
            {!pending && active && !renewSoon && (
              <Button asChild variant="outline" size="sm"><Link href="/courses">Jelajahi materi</Link></Button>
            )}
            {!pending && !active && (
              <>
                {previous && <p className="note-box-warn font-heading text-sm">{previous}</p>}
                <SubscriptionRequestForm />
              </>
            )}
          </CardContent>
        </Card>

        {history.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Riwayat pengajuan</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Diajukan</TableHead><TableHead>Status</TableHead><TableHead>Berlaku hingga</TableHead><TableHead>Catatan admin</TableHead></TableRow></TableHeader>
                <TableBody>
                  {history.map((s) => {
                    const st = effectiveStatus(s);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap">{fmtDate(s.created_at)}</TableCell>
                        <TableCell><Badge variant={st === 'active' ? 'default' : 'secondary'}>{SUBSCRIPTION_STATUS_LABEL[st]}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap">{st === 'active' || st === 'expired' ? (s.expires_at ? fmtDate(s.expires_at) : 'Tanpa batas') : '–'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.admin_note ?? '–'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Tingkat akses materi</CardTitle>
          <CardDescription>Setiap materi punya satu tingkat akses. Yang belum terbuka tetap bisa dibaca pratinjaunya.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ACCESS_LEVELS.map((l) => {
            const Icon = LEVEL_ICON[l];
            return (
              <div key={l} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-primary"><Icon className="h-4 w-4" /></span>
                <div>
                  <p className="font-heading text-sm font-bold">{ACCESS_LEVEL_LABEL[l]} <span className="font-medium text-muted-foreground">· {counts[l]} materi</span></p>
                  <p className="text-sm text-muted-foreground">{ACCESS_LEVEL_HELP[l]}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
