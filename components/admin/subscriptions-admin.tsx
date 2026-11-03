'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, CalendarClock, Check, CheckCheck, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/site/page-parts';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { daysLeft, effectiveStatus } from '@/lib/access';
import { SUBSCRIPTION_STATUS_LABEL, errorMessage, fmtDate, fmtDateTime } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { SubscriptionStatus } from '@/lib/database.types';

export type AdminSubscription = {
  id: string; user_id: string; status: SubscriptionStatus; message: string | null; admin_note: string | null;
  expires_at: string | null; reviewed_at: string | null; created_at: string;
  profiles: { email: string | null; display_name: string | null } | null;
};
export type SubscriptionTab = 'pending' | 'active' | 'history';

type Action = { kind: 'approve' | 'reject' | 'expiry' | 'revoke'; rows: AdminSubscription[] };
type Preset = 'none' | '1m' | '6m' | '1y' | 'custom';

const PRESETS: Record<Preset, string> = {
  none: 'Tanpa batas waktu', '1m': '1 bulan', '6m': '6 bulan (satu semester)', '1y': '1 tahun', custom: 'Sampai tanggal tertentu',
};

/** Akhir masa berlaku dari pilihan admin; undefined bila tanggal tertentu belum valid */
function expiryFrom(preset: Preset, date: string): string | null | undefined {
  if (preset === 'none') return null;
  if (preset === 'custom') {
    const d = new Date(`${date}T23:59:59`);
    return date && d.getTime() > Date.now() ? d.toISOString() : undefined;
  }
  const d = new Date();
  d.setMonth(d.getMonth() + (preset === '1m' ? 1 : preset === '6m' ? 6 : 12));
  return d.toISOString();
}

const who = (r: AdminSubscription) => r.profiles?.display_name || r.profiles?.email?.split('@')[0] || 'Pengguna';

export function SubscriptionsAdmin({ rows, initialTab }: { rows: AdminSubscription[]; initialTab: SubscriptionTab }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<SubscriptionTab>(initialTab);
  const [filter, setFilter] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [preset, setPreset] = useState<Preset>('6m');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const shown = rows.filter((r) => !f || `${r.profiles?.email} ${r.profiles?.display_name} ${r.message}`.toLowerCase().includes(f));
    return {
      pending: shown.filter((r) => r.status === 'pending').reverse(),   // yang paling lama menunggu di atas
      active: shown.filter((r) => effectiveStatus(r) === 'active'),
      history: shown.filter((r) => r.status !== 'pending' && effectiveStatus(r) !== 'active'),
    };
  }, [rows, filter]);

  function open(kind: Action['kind'], targets: AdminSubscription[]) {
    setAction({ kind, rows: targets });
    setNote('');
    setPreset(kind === 'expiry' && targets[0]?.expires_at === null ? 'none' : '6m');
    setDate('');
  }

  async function run() {
    if (!action) return;
    const expires = expiryFrom(preset, date);
    if ((action.kind === 'approve' || action.kind === 'expiry') && expires === undefined) {
      return toast({ title: 'Pilih tanggal setelah hari ini', variant: 'destructive' });
    }
    const db = getSupabaseBrowser();
    const p_note = note.trim() || null;
    setBusy(true);
    let done = 0;
    for (const r of action.rows) {
      const { error } =
        action.kind === 'approve' ? await db.rpc('review_subscription', { p_id: r.id, p_approve: true, p_expires_at: expires ?? null, p_note }) :
        action.kind === 'reject' ? await db.rpc('review_subscription', { p_id: r.id, p_approve: false, p_note }) :
        action.kind === 'expiry' ? await db.rpc('set_subscription_expiry', { p_id: r.id, p_expires_at: expires ?? null }) :
        await db.rpc('revoke_subscription', { p_id: r.id, p_note });
      if (error) {
        toast({ title: `Gagal untuk ${who(r)}`, description: errorMessage(error), variant: 'destructive' });
        break;
      }
      done++;
    }
    setBusy(false);
    if (done) {
      const verb = { approve: 'disetujui', reject: 'ditolak', expiry: 'diperbarui', revoke: 'dicabut' }[action.kind];
      toast({ title: done > 1 ? `${done} langganan ${verb}` : `Langganan ${who(action.rows[0])} ${verb}` });
    }
    setAction(null);
    router.refresh();
  }

  const tabs: { key: SubscriptionTab; label: string; n: number }[] = [
    { key: 'pending', label: 'Menunggu', n: groups.pending.length },
    { key: 'active', label: 'Aktif', n: groups.active.length },
    { key: 'history', label: 'Riwayat', n: groups.history.length },
  ];
  const user = (r: AdminSubscription) => (
    <div className="min-w-0">
      <p className="truncate font-heading text-sm font-bold">{who(r)}</p>
      <p className="truncate text-xs text-muted-foreground">{r.profiles?.email}</p>
    </div>
  );
  const kind = action?.kind;
  const many = (action?.rows.length ?? 0) > 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="pill-tabs inline-flex max-w-full overflow-x-auto" role="tablist" aria-label="Kelompok langganan">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cn('whitespace-nowrap rounded-full px-3.5 py-1.5 font-heading text-[0.8rem] font-bold', tab === t.key ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background/70')}>
              {t.label} <span className="tabular-nums opacity-75">({t.n})</span>
            </button>
          ))}
        </div>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari nama, email, atau pesan" aria-label="Cari langganan" className="sm:max-w-xs" />
      </div>

      {tab === 'pending' && (
        groups.pending.length === 0 ? (
          <EmptyState title="Tidak ada pengajuan yang menunggu" description="Pengajuan baru dari pengguna akan muncul di sini." />
        ) : (
          <div className="space-y-3">
            {groups.pending.length > 1 && (
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => open('approve', groups.pending)}><CheckCheck className="mr-1.5 h-4 w-4" /> Setujui semua ({groups.pending.length})</Button>
              </div>
            )}
            {groups.pending.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    {user(r)}
                    <p className="font-heading text-xs text-muted-foreground">Diajukan {fmtDateTime(r.created_at)}</p>
                    {r.message && <p className="note-box text-sm">{r.message}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => open('approve', [r])}><Check className="mr-1 h-4 w-4" /> Setujui</Button>
                    <Button size="sm" variant="outline" onClick={() => open('reject', [r])}><X className="mr-1 h-4 w-4" /> Tolak</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {tab === 'active' && (
        groups.active.length === 0 ? (
          <EmptyState title="Belum ada pelanggan aktif" description="Langganan yang disetujui tampil di sini." />
        ) : (
          <Card><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Pengguna</TableHead><TableHead>Disetujui</TableHead><TableHead>Berlaku hingga</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
              <TableBody>
                {groups.active.map((r) => {
                  const left = daysLeft(r.expires_at);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-[16rem]">{user(r)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.reviewed_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {r.expires_at ? <>{fmtDate(r.expires_at)} <span className={cn('text-xs', left != null && left <= 14 ? 'font-bold text-destructive' : 'text-muted-foreground')}>({left} hari)</span></> : 'Tanpa batas'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => open('expiry', [r])}><CalendarClock className="mr-1 h-4 w-4" /> Masa berlaku</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => open('revoke', [r])}><Ban className="mr-1 h-4 w-4" /> Cabut</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        )
      )}

      {tab === 'history' && (
        groups.history.length === 0 ? (
          <EmptyState title="Riwayat masih kosong" description="Pengajuan yang ditolak, dibatalkan, dicabut, atau kedaluwarsa tampil di sini." />
        ) : (
          <Card><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Pengguna</TableHead><TableHead>Diajukan</TableHead><TableHead>Status</TableHead><TableHead>Catatan admin</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {groups.history.map((r) => {
                  const st = effectiveStatus(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-[16rem]">{user(r)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="secondary">{SUBSCRIPTION_STATUS_LABEL[st]}</Badge>
                        {st === 'expired' && <span className="ml-1.5 text-xs text-muted-foreground">{fmtDate(r.expires_at)}</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.admin_note ?? '–'}</TableCell>
                      <TableCell className="text-right">
                        {st === 'expired' && <Button size="sm" variant="ghost" onClick={() => open('expiry', [r])}><CalendarClock className="mr-1 h-4 w-4" /> Aktifkan lagi</Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        )
      )}

      <Dialog open={!!action} onOpenChange={(o) => { if (!o && !busy) setAction(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {kind === 'approve' ? (many ? `Setujui ${action!.rows.length} pengajuan` : 'Setujui langganan') :
               kind === 'reject' ? 'Tolak pengajuan' : kind === 'expiry' ? 'Atur masa berlaku' : 'Cabut langganan'}
            </DialogTitle>
            <DialogDescription>
              {many ? 'Semua pengajuan yang menunggu mendapat masa berlaku yang sama.' : action ? `${who(action.rows[0])} · ${action.rows[0].profiles?.email ?? ''}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(kind === 'approve' || kind === 'expiry') && (
              <div className="space-y-2">
                <Label>Berlaku</Label>
                <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRESETS) as Preset[]).map((p) => <SelectItem key={p} value={p}>{PRESETS[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
                {preset === 'custom' && (
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Tanggal akhir langganan" />
                )}
                {preset !== 'custom' && preset !== 'none' && (
                  <p className="font-heading text-xs text-muted-foreground">Berakhir {fmtDate(expiryFrom(preset, date) ?? null)}.</p>
                )}
              </div>
            )}
            {kind === 'revoke' && (
              <p className="text-sm text-muted-foreground">Akses ke materi berlabel Langganan langsung tertutup, termasuk materi yang sedang dibuka.</p>
            )}
            {kind !== 'expiry' && (
              <div className="space-y-2">
                <Label htmlFor="sub-note">{kind === 'approve' ? 'Catatan untuk pengguna (opsional)' : 'Alasan, ditampilkan ke pengguna (opsional)'}</Label>
                <Textarea id="sub-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={busy}>Batal</Button>
            <Button variant={kind === 'reject' || kind === 'revoke' ? 'destructive' : 'default'} onClick={run} disabled={busy}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {kind === 'approve' ? 'Setujui' : kind === 'reject' ? 'Tolak' : kind === 'expiry' ? 'Simpan' : 'Cabut'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
