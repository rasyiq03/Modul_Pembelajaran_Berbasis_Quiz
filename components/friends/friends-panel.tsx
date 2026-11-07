'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, Gamepad2, Loader2, Trophy, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage, fmtDate } from '@/lib/labels';
import { fmtPts } from '@/lib/arena';
import { cn } from '@/lib/utils';

type Friend = { id: string; user_id: string; name: string | null; since: string | null; week_points: number; week_runs: number; total_runs: number; best_score: number | null };
type Request = { id: string; name: string | null; created_at: string };
export type FriendsData = { code: string; friends: Friend[]; incoming: Request[]; outgoing: Request[]; me: { week_points: number; week_runs: number } };

const nameOf = (n: string | null) => n || 'Tanpa nama';

export function FriendsPanel({ data, myName }: { data: FriendsData; myName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = getSupabaseBrowser();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function run(id: string, fn: () => PromiseLike<{ error: unknown }>, done?: string) {
    setBusy(id);
    const { error } = await fn();
    setBusy(null);
    if (error) return toast({ title: 'Belum berhasil', description: errorMessage(error), variant: 'destructive' });
    if (done) toast({ title: done });
    router.refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy('add');
    const { data: r, error } = await supabase.rpc('send_friend_request', { p_code: code });
    setBusy(null);
    if (error) return toast({ title: 'Belum berhasil', description: errorMessage(error), variant: 'destructive' });
    setCode('');
    toast({ title: r?.status === 'accepted' ? `Kamu dan ${nameOf(r.name)} sekarang berteman` : `Permintaan terkirim ke ${nameOf(r?.name ?? null)}` });
    router.refresh();
  }

  async function copy() {
    try { await navigator.clipboard.writeText(data.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* izin clipboard ditolak */ }
  }

  /* Papan peringkat mingguan: aku + teman, berdasarkan total skor Arena 7 hari terakhir */
  const weekly = [
    { key: 'me', name: myName, points: data.me.week_points, runs: data.me.week_runs, me: true },
    ...data.friends.map((f) => ({ key: f.id, name: nameOf(f.name), points: f.week_points, runs: f.week_runs, me: false })),
  ].sort((a, b) => b.points - a.points || (a.me ? -1 : 1));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Trophy className="h-5 w-5" /> Peringkat Arena minggu ini</CardTitle>
            <CardDescription>Total skor Arena 7 hari terakhir. Main lebih sering untuk menyalip temanmu.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada teman. Bagikan kode temanmu atau masukkan kode teman di samping.</p>
            ) : (
              <ol className="space-y-1.5 font-heading text-sm">
                {weekly.map((w, i) => (
                  <li key={w.key} className={cn('flex items-center justify-between gap-3 rounded-lg border-2 px-3 py-2', w.me ? 'border-ink bg-[hsl(var(--yellow))] text-[#1A1A1A]' : 'border-transparent bg-secondary')}>
                    <span className="truncate font-bold">{i + 1}. {w.name}{w.me && ' (kamu)'}</span>
                    <span className="shrink-0"><b>{fmtPts(w.points)}</b> <span className="text-xs opacity-75">· {w.runs}× main</span></span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Teman ({data.friends.length})</CardTitle></CardHeader>
          <CardContent>
            {data.friends.length === 0 ? <p className="text-sm text-muted-foreground">Daftar temanmu masih kosong.</p> : (
              <ul className="divide-y rounded-md border-[1.5px] font-heading text-sm">
                {data.friends.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <span className="min-w-0">
                      <b className="block truncate">{nameOf(f.name)}</b>
                      <span className="text-xs text-muted-foreground">
                        Berteman sejak {fmtDate(f.since)} · {f.total_runs}× main Arena{f.best_score != null ? ` · skor terbaik ${fmtPts(f.best_score)}` : ''}
                      </span>
                    </span>
                    {confirmRemove === f.id ? (
                      <span className="flex gap-1">
                        <Button size="sm" variant="destructive" disabled={busy === f.id} onClick={() => run(f.id, () => supabase.rpc('remove_friend', { p_id: f.id }), 'Teman dihapus')}>Ya, hapus</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>Batal</Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(f.id)}>Hapus</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              <Gamepad2 className="mr-1 inline h-4 w-4" /> Skor terbaik kalian di setiap Arena tampil di akhir permainan. <Link href="/quizzes">Main Arena</Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kode temanmu</CardTitle>
            <CardDescription>Bagikan ke teman supaya mereka bisa menambahkanmu. Email-mu tidak ditampilkan ke siapa pun.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border-2 border-ink bg-secondary px-3 py-2 text-center font-heading text-xl font-extrabold tracking-[0.2em]">{data.code || '–'}</code>
            <Button variant="outline" size="icon" onClick={copy} aria-label="Salin kode teman" title="Salin">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Tambah teman</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={add} className="space-y-2">
              <Label htmlFor="fc">Kode teman</Label>
              <div className="flex gap-2">
                <Input id="fc" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} placeholder="mis. K7QM2XPA" autoComplete="off" className="font-heading uppercase tracking-widest" />
                <Button type="submit" disabled={busy === 'add' || !code.trim()}>{busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}<span className="sr-only">Kirim permintaan</span></Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {data.incoming.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Permintaan masuk ({data.incoming.length})</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 font-heading text-sm">
                {data.incoming.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold">{nameOf(r.name)}</span>
                    <span className="flex shrink-0 gap-1">
                      <Button size="sm" disabled={busy === r.id} onClick={() => run(r.id, () => supabase.rpc('respond_friend_request', { p_id: r.id, p_accept: true }), `Kamu dan ${nameOf(r.name)} sekarang berteman`)}><Check className="mr-1 h-4 w-4" /> Terima</Button>
                      <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => run(r.id, () => supabase.rpc('respond_friend_request', { p_id: r.id, p_accept: false }))} aria-label={`Tolak ${nameOf(r.name)}`}><X className="h-4 w-4" /></Button>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {data.outgoing.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Menunggu jawaban</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 font-heading text-sm">
                {data.outgoing.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0"><b className="block truncate">{nameOf(r.name)}</b><span className="text-xs text-muted-foreground">Dikirim {fmtDate(r.created_at)}</span></span>
                    <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => run(r.id, () => supabase.rpc('remove_friend', { p_id: r.id }), 'Permintaan dibatalkan')}>Batalkan</Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
