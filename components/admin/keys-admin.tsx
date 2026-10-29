'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, KeyRound, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage, fmtDate, fmtDateTime } from '@/lib/labels';

type Key = { id: string; key_prefix: string; material_id: string; expires_at: string | null; max_uses: number | null; uses_count: number; revoked: boolean; note: string | null; created_at: string; materials: { title: string } | null };
type Enr = { id: string; user_id: string; material_id: string; source: string; revoked: boolean; revoked_at: string | null; created_at: string; materials: { title: string } | null; profiles: { email: string | null; display_name: string | null } | null };
type Mat = { id: string; title: string; status: string; courses: { title: string } | null };

const keyState = (k: Key) =>
  k.revoked ? ['Dicabut', 'destructive'] as const
  : k.expires_at && Date.parse(k.expires_at) < Date.now() ? ['Kedaluwarsa', 'secondary'] as const
  : k.max_uses != null && k.uses_count >= k.max_uses ? ['Kuota habis', 'secondary'] as const
  : ['Aktif', 'default'] as const;

export function KeysAdmin({ keys, enrollments, materials }: { keys: Key[]; enrollments: Enr[]; materials: Mat[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = getSupabaseBrowser();
  const [material, setMaterial] = useState(materials[0]?.id ?? '');
  const [expires, setExpires] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ key: string; title: string } | null>(null);
  const [filter, setFilter] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc('create_enrollment_key', {
      p_material: material,
      p_expires_at: expires ? new Date(expires + 'T23:59:59').toISOString() : null,
      p_max_uses: maxUses ? Number(maxUses) : null,
      p_note: note || null,
    });
    setBusy(false);
    if (error) return toast({ title: 'Gagal membuat key', description: errorMessage(error), variant: 'destructive' });
    setCreated({ key: data.key, title: materials.find((m) => m.id === material)?.title ?? '' });
    setNote(''); setMaxUses(''); setExpires('');
    router.refresh();
  }

  async function setRevoked(k: Key, revoked: boolean) {
    if (revoked && !confirm(`Cabut key ${k.key_prefix}…? Akses yang sudah terbentuk tetap berlaku.`)) return;
    const { error } = await supabase.from('enrollment_keys').update({ revoked }).eq('id', k.id);
    if (error) return toast({ title: 'Gagal', description: errorMessage(error), variant: 'destructive' });
    router.refresh();
  }

  async function setEnrollment(e: Enr, revoked: boolean) {
    if (revoked && !confirm(`Cabut akses ${e.profiles?.email ?? 'pengguna ini'} ke "${e.materials?.title}"?`)) return;
    const { error } = await supabase.rpc('set_enrollment_revoked', { p_enrollment: e.id, p_revoked: revoked });
    if (error) return toast({ title: 'Gagal', description: errorMessage(error), variant: 'destructive' });
    toast({ title: revoked ? 'Akses dicabut' : 'Akses dipulihkan' });
    router.refresh();
  }

  const shownEnr = useMemo(() => {
    const f = filter.toLowerCase();
    return enrollments.filter((e) => !f || `${e.profiles?.email} ${e.profiles?.display_name} ${e.materials?.title}`.toLowerCase().includes(f));
  }, [enrollments, filter]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Buat key baru</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-4 md:grid-cols-4 md:items-end">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="km">Materi</Label>
              <select id="km" value={material} onChange={(e) => setMaterial(e.target.value)} required className="h-10 w-full rounded-md border-[1.5px] border-input bg-background px-3 font-heading text-sm">
                {materials.map((m) => <option key={m.id} value={m.id}>{m.courses?.title ? `${m.courses.title} · ` : ''}{m.title}{m.status !== 'published' ? ' (draf)' : ''}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ke">Berlaku sampai</Label>
              <Input id="ke" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ku">Batas pemakaian</Label>
              <Input id="ku" type="number" min={1} placeholder="Tanpa batas" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="kn">Catatan</Label>
              <Input id="kn" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Kelas TI-2A semester ganjil" />
            </div>
            <Button type="submit" disabled={busy || !material}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />} Buat key</Button>
          </form>
          {created && (
            <div className="note-box mt-4 space-y-2" role="status">
              <p className="text-sm">Key untuk <b>{created.title}</b>. Salin sekarang: key hanya ditampilkan sekali, yang disimpan hanya hash-nya.</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-card px-3 py-2 font-heading text-lg font-extrabold tracking-widest" data-testid="new-key">{created.key}</code>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(created.key)}><Copy className="mr-1 h-4 w-4" /> Salin</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Daftar key</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Awalan</TableHead><TableHead>Materi</TableHead><TableHead>Status</TableHead><TableHead>Dipakai</TableHead><TableHead>Berlaku sampai</TableHead><TableHead>Catatan</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {keys.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Belum ada key.</TableCell></TableRow>}
              {keys.map((k) => {
                const [label, variant] = keyState(k);
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-heading font-bold">{k.key_prefix}-…</TableCell>
                    <TableCell>{k.materials?.title}</TableCell>
                    <TableCell><Badge variant={variant}>{label}</Badge></TableCell>
                    <TableCell>{k.uses_count}{k.max_uses != null ? ` / ${k.max_uses}` : ''}</TableCell>
                    <TableCell>{fmtDate(k.expires_at)}</TableCell>
                    <TableCell className="max-w-[16rem] truncate">{k.note}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => setRevoked(k, !k.revoked)}>{k.revoked ? 'Aktifkan lagi' : 'Cabut'}</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-lg">Enrollment ({enrollments.length})</CardTitle>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari email atau materi" className="max-w-xs" aria-label="Cari enrollment" />
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Pengguna</TableHead><TableHead>Materi</TableHead><TableHead>Sejak</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {shownEnr.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada enrollment.</TableCell></TableRow>}
              {shownEnr.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.profiles?.display_name}<div className="text-xs text-muted-foreground">{e.profiles?.email}</div></TableCell>
                  <TableCell>{e.materials?.title}</TableCell>
                  <TableCell>{fmtDateTime(e.created_at)}</TableCell>
                  <TableCell>{e.revoked ? <Badge variant="destructive">Dicabut</Badge> : <Badge>Aktif</Badge>}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => setEnrollment(e, !e.revoked)}>{e.revoked ? 'Pulihkan' : 'Cabut akses'}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
