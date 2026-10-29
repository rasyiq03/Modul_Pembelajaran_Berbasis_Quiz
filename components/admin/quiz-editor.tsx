'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Eye, Loader2, Plus, Radio, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { FEEDBACK_LABEL, QUESTION_TYPE_LABEL, QUIZ_MODES, QUIZ_MODE_HELP, QUIZ_MODE_LABEL, STATUS_LABEL, errorMessage, type Feedback } from '@/lib/labels';
import type { QuestionType, QuizMode, Status } from '@/lib/database.types';
import { plain } from '@/lib/rich';
import { cn } from '@/lib/utils';

export type BankQuestion = { id: string; type: QuestionType; prompt: string; status: Status; topic: string | null; material_ids: string[] };
export type EditorQuiz = {
  id?: string; title: string; description: string | null; mode: QuizMode; status: Status;
  settings: {
    shuffle_questions?: boolean; shuffle_options?: boolean; time_limit_sec?: number | null; question_time_sec?: number;
    attempts_allowed?: number | null; show_feedback?: Feedback; allow_guests?: boolean; pass_threshold?: number; show_leaderboard?: boolean;
  };
  questions: { question_id: string; points: number }[];
};
type Material = { id: string; title: string; course: string };

const sel = 'h-10 w-full rounded-md border-[1.5px] border-input bg-background px-3 font-heading text-sm';
const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-2 font-heading text-sm"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" /> {label}</label>
);

export function QuizEditor({ quiz, bank, materials }: { quiz: EditorQuiz; bank: BankQuestion[]; materials: Material[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [z, setZ] = useState<EditorQuiz>(quiz);
  const [mats, setMats] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(bank.map((b) => [b.id, b])), [bank]);
  const chosen = new Set(z.questions.map((q) => q.question_id));
  const s = z.settings;
  const setS = (patch: Partial<EditorQuiz['settings']>) => setZ((x) => ({ ...x, settings: { ...x.settings, ...patch } }));

  /* FR-37: soal dari satu atau beberapa materi sekaligus */
  const available = bank.filter((b) =>
    !chosen.has(b.id) && b.status !== 'archived'
    && (!mats.length || b.material_ids.some((m) => mats.includes(m)))
    && (!search || plain(b.prompt).toLowerCase().includes(search.toLowerCase())));

  const add = (ids: string[]) => setZ((x) => ({ ...x, questions: [...x.questions, ...ids.map((id) => ({ question_id: id, points: 1 }))] }));
  const move = (i: number, d: number) => setZ((x) => { const q = [...x.questions]; [q[i], q[i + d]] = [q[i + d], q[i]]; return { ...x, questions: q }; });

  async function save(status?: Status) {
    setBusy(true);
    const { data, error } = await getSupabaseBrowser().rpc('admin_save_quiz', { p: { ...z, status: status ?? z.status } });
    setBusy(false);
    if (error) return toast({ title: 'Kuis belum tersimpan', description: errorMessage(error), variant: 'destructive' });
    if (status) setZ((x) => ({ ...x, status }));
    toast({ title: 'Kuis tersimpan' });
    if (!z.id) router.replace(`/admin/quizzes/${data}`);
    else router.refresh();
  }

  const totalPoints = z.questions.reduce((t, q) => t + Number(q.points || 0), 0);
  const unpublished = z.questions.filter((q) => byId.get(q.question_id)?.status !== 'published').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="zt">Judul</Label>
              <Input id="zt" value={z.title} onChange={(e) => setZ({ ...z, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zd">Deskripsi</Label>
              <Textarea id="zd" rows={2} value={z.description ?? ''} onChange={(e) => setZ({ ...z, description: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="zm">Mode</Label>
                <select id="zm" className={sel} value={z.mode} onChange={(e) => setZ({ ...z, mode: e.target.value as QuizMode })}>
                  {QUIZ_MODES.map((m) => <option key={m} value={m}>{QUIZ_MODE_LABEL[m]}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">{QUIZ_MODE_HELP[z.mode]}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zf">Tampilkan kunci & pembahasan</Label>
                <select id="zf" className={sel} value={s.show_feedback ?? (z.mode === 'interactive_practice' ? 'after_each' : 'after_submit')} onChange={(e) => setS({ show_feedback: e.target.value as Feedback })}>
                  {Object.entries(FEEDBACK_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zl">Batas waktu kuis (menit)</Label>
                <Input id="zl" type="number" min={1} placeholder={z.mode === 'timed_assessment' ? 'Wajib diisi' : 'Tanpa batas'}
                  value={s.time_limit_sec ? Math.round(s.time_limit_sec / 60) : ''} onChange={(e) => setS({ time_limit_sec: e.target.value ? Number(e.target.value) * 60 : null })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zq">Waktu per soal di sesi live (detik)</Label>
                <Input id="zq" type="number" min={5} max={600} value={s.question_time_sec ?? 30} onChange={(e) => setS({ question_time_sec: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="za">Jumlah percobaan</Label>
                <Input id="za" type="number" min={1} placeholder="Tak terbatas" disabled={z.mode === 'self_paced_assessment'}
                  value={z.mode === 'self_paced_assessment' ? 1 : s.attempts_allowed ?? ''} onChange={(e) => setS({ attempts_allowed: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zp">Batas lulus (%)</Label>
                <Input id="zp" type="number" min={0} max={100} value={s.pass_threshold ?? 60} onChange={(e) => setS({ pass_threshold: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Check label="Acak urutan soal" checked={!!s.shuffle_questions} onChange={(v) => setS({ shuffle_questions: v })} />
              <Check label="Acak urutan pilihan jawaban" checked={!!s.shuffle_options} onChange={(v) => setS({ shuffle_options: v })} />
              <Check label="Tamu boleh ikut tanpa akun" checked={!!s.allow_guests} onChange={(v) => setS({ allow_guests: v })} />
              <Check label="Papan peringkat di sesi live" checked={s.show_leaderboard ?? true} onChange={(v) => setS({ show_leaderboard: v })} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5 font-heading text-sm">
            <p><b>Status:</b> {STATUS_LABEL[z.status]}</p>
            <p>{z.questions.length} soal · {totalPoints} poin total</p>
            {unpublished > 0 && <p className="note-box-warn text-xs">{unpublished} soal masih draf. Publikasikan soalnya sebelum kuis dipublikasikan.</p>}
            <Button className="w-full" onClick={() => save()} disabled={busy}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Simpan</Button>
            {z.status !== 'published'
              ? <Button className="w-full" variant="outline" onClick={() => save('published')} disabled={busy}>Simpan & publikasikan</Button>
              : <Button className="w-full" variant="outline" onClick={() => save('draft')} disabled={busy}>Jadikan draf</Button>}
            {z.status !== 'archived' && z.id && <Button className="w-full" variant="ghost" onClick={() => save('archived')} disabled={busy}>Arsipkan</Button>}
            {z.id && (
              <div className="flex flex-col gap-2 border-t pt-3">
                <Button asChild variant="outline" size="sm"><Link href={`/quizzes/${z.id}`} target="_blank"><Eye className="mr-1 h-4 w-4" /> Pratinjau sebagai peserta</Link></Button>
                <Button asChild variant="outline" size="sm"><Link href={`/admin/sessions?quiz=${z.id}`}><Radio className="mr-1 h-4 w-4" /> Buka sesi live</Link></Button>
                <Button asChild variant="ghost" size="sm"><Link href={`/admin/results?quiz=${z.id}`}>Lihat hasil</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Soal di kuis ({z.questions.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {z.questions.length === 0 && <p className="text-sm text-muted-foreground">Tambahkan soal dari bank soal di sebelah.</p>}
            <ol className="space-y-2">
              {z.questions.map((q, i) => {
                const b = byId.get(q.question_id);
                return (
                  <li key={q.question_id} className="flex items-start gap-2 rounded-md border-[1.5px] p-2.5">
                    <span className="mt-1 w-6 font-heading text-sm font-extrabold">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm">{plain(b?.prompt ?? '(soal tidak ditemukan)')}</p>
                      <p className="font-heading text-xs text-muted-foreground">{b ? QUESTION_TYPE_LABEL[b.type] : ''}{b?.status !== 'published' ? ' · draf' : ''}</p>
                    </div>
                    <Input type="number" min={0} step="0.5" value={q.points} aria-label={`Poin soal ${i + 1}`} className="h-8 w-16"
                      onChange={(e) => setZ((x) => ({ ...x, questions: x.questions.map((y, k) => (k === i ? { ...y, points: Number(e.target.value) } : y)) }))} />
                    <div className="flex flex-col">
                      <button type="button" aria-label="Naikkan" disabled={i === 0} onClick={() => move(i, -1)} className="p-0.5 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" aria-label="Turunkan" disabled={i === z.questions.length - 1} onClick={() => move(i, 1)} className="p-0.5 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    </div>
                    <button type="button" aria-label="Keluarkan dari kuis" onClick={() => setZ((x) => ({ ...x, questions: x.questions.filter((_, k) => k !== i) }))} className="p-1 text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Bank soal</CardTitle>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari soal" aria-label="Cari soal di bank" />
            <details className="rounded-md border-[1.5px] p-2 font-heading text-sm">
              <summary className="cursor-pointer font-bold">Saring materi {mats.length ? `(${mats.length})` : ''}</summary>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {materials.map((m) => (
                  <label key={m.id} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={mats.includes(m.id)} onChange={(e) => setMats(e.target.checked ? [...mats, m.id] : mats.filter((x) => x !== m.id))} />
                    <span>{m.title} <span className="text-xs text-muted-foreground">· {m.course}</span></span>
                  </label>
                ))}
              </div>
            </details>
            <Button size="sm" variant="outline" disabled={!available.length} onClick={() => add(available.slice(0, 200).map((a) => a.id))}>
              <Plus className="mr-1 h-4 w-4" /> Tambahkan semua ({Math.min(available.length, 200)})
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="max-h-[32rem] space-y-1.5 overflow-y-auto">
              {available.slice(0, 300).map((b) => (
                <li key={b.id} className={cn('flex items-start gap-2 rounded-md p-2 hover:bg-secondary')}>
                  <button type="button" onClick={() => add([b.id])} aria-label="Tambahkan ke kuis" className="mt-0.5 rounded bg-primary p-1 text-primary-foreground"><Plus className="h-3.5 w-3.5" /></button>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm">{plain(b.prompt)}</p>
                    <p className="font-heading text-xs text-muted-foreground">{QUESTION_TYPE_LABEL[b.type]}{b.topic ? ` · ${b.topic}` : ''}{b.status !== 'published' ? ' · draf' : ''}</p>
                  </div>
                </li>
              ))}
              {available.length === 0 && <li className="text-sm text-muted-foreground">Tidak ada soal yang cocok.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
