'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { DIFFICULTY_LABEL, QUESTION_TYPES, QUESTION_TYPE_LABEL, STATUS_LABEL, errorMessage } from '@/lib/labels';
import type { QuestionType, Status } from '@/lib/database.types';
import { rich } from '@/lib/rich';

export type EditorQuestion = {
  id?: string; type: QuestionType; prompt: string; media_url: string | null; topic: string | null;
  difficulty: string | null; status: Status; options: { key: string; label: string; side: 'left' | 'right' | null }[];
  answer: any; explanation: string | null; material_ids: string[]; tags: string[];
};
type Material = { id: string; title: string; course: string };

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const sel = 'h-10 w-full rounded-md border-[1.5px] border-input bg-background px-3 font-heading text-sm';

/* Bentuk kerja editor per jenis soal ↔ format server (options + answer) */
type Draft = {
  choices: { label: string; correct: boolean }[];
  tf: boolean | null;
  accepted: string;
  pairs: { left: string; right: string }[];
  items: string[];
};
function toDraft(q: EditorQuestion): Draft {
  const a = q.answer ?? {};
  const label = (k: string) => q.options.find((o) => o.key === k)?.label ?? '';
  const choiceKeys = q.type === 'single_choice' ? [a.answer] : a.answers ?? [];
  const lefts = q.options.filter((o) => o.side === 'left');
  return {
    choices: ['single_choice', 'multiple_select'].includes(q.type) && q.options.length
      ? q.options.map((o) => ({ label: o.label, correct: choiceKeys.includes(o.key) }))
      : [{ label: '', correct: true }, { label: '', correct: false }, { label: '', correct: false }, { label: '', correct: false }],
    tf: typeof a.answer === 'boolean' ? a.answer : null,
    accepted: (a.accepted ?? []).join('\n'),
    pairs: lefts.length ? lefts.map((l) => ({ left: l.label, right: label(a.pairs?.[l.key]) })) : [{ left: '', right: '' }, { left: '', right: '' }],
    items: q.type === 'ordering' && a.order?.length ? a.order.map(label) : ['', '', ''],
  };
}
function fromDraft(type: QuestionType, d: Draft): Pick<EditorQuestion, 'options' | 'answer'> {
  switch (type) {
    case 'single_choice': case 'multiple_select': {
      const opts = d.choices.filter((c) => c.label.trim()).map((c, i) => ({ key: LETTERS[i], label: c.label.trim(), side: null, correct: c.correct }));
      const right = opts.filter((o) => o.correct).map((o) => o.key);
      return { options: opts.map(({ key, label, side }) => ({ key, label, side })), answer: type === 'single_choice' ? { answer: right[0] ?? null } : { answers: right } };
    }
    case 'true_false': return { options: [], answer: { answer: d.tf } };
    case 'short_answer': return { options: [], answer: { accepted: d.accepted.split('\n').map((x) => x.trim()).filter(Boolean) } };
    case 'essay': return { options: [], answer: {} };
    case 'matching': {
      const ps = d.pairs.filter((p) => p.left.trim() && p.right.trim());
      return {
        options: [...ps.map((p, i) => ({ key: `L${i + 1}`, label: p.left.trim(), side: 'left' as const })), ...ps.map((p, i) => ({ key: `R${i + 1}`, label: p.right.trim(), side: 'right' as const }))],
        answer: { pairs: Object.fromEntries(ps.map((_, i) => [`L${i + 1}`, `R${i + 1}`])) },
      };
    }
    case 'ordering': {
      const items = d.items.map((x) => x.trim()).filter(Boolean);
      return { options: items.map((label, i) => ({ key: LETTERS[i], label, side: null })), answer: { order: items.map((_, i) => LETTERS[i]) } };
    }
  }
}

export function QuestionEditor({ question, materials }: { question: EditorQuestion; materials: Material[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState<EditorQuestion>(question);
  const [d, setD] = useState<Draft>(() => toDraft(question));
  const [tags, setTags] = useState(question.tags.join(', '));
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<EditorQuestion>) => setQ((x) => ({ ...x, ...patch }));
  const setDraft = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  async function save() {
    setBusy(true);
    const payload = { ...q, ...fromDraft(q.type, d), tags: tags.split(',').map((t) => t.trim()).filter(Boolean) };
    const { data, error } = await getSupabaseBrowser().rpc('admin_save_question', { p: payload });
    setBusy(false);
    if (error) return toast({ title: 'Soal belum tersimpan', description: errorMessage(error), variant: 'destructive' });
    toast({ title: 'Soal tersimpan' });
    if (!q.id) router.replace(`/admin/questions/${data}`);
    else router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="qt">Jenis soal</Label>
                <select id="qt" className={sel} value={q.type} onChange={(e) => set({ type: e.target.value as QuestionType })}>
                  {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qs">Status</Label>
                <select id="qs" className={sel} value={q.status} onChange={(e) => set({ status: e.target.value as Status })}>
                  {(['draft', 'published', 'archived'] as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qp">Teks soal</Label>
              <Textarea id="qp" rows={3} value={q.prompt} onChange={(e) => set({ prompt: e.target.value })} placeholder="Tulis pertanyaan. Boleh memakai <b>, <i>, <sub>, <sup>, <code>." />
              {q.prompt && <p className="rounded-md bg-secondary p-3 font-heading text-sm" dangerouslySetInnerHTML={{ __html: rich(q.prompt) }} />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Jawaban</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(q.type === 'single_choice' || q.type === 'multiple_select') && (
              <>
                <p className="text-sm text-muted-foreground">{q.type === 'single_choice' ? 'Tandai satu jawaban benar.' : 'Tandai semua jawaban benar.'}</p>
                {d.choices.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type={q.type === 'single_choice' ? 'radio' : 'checkbox'} name="correct" checked={c.correct} aria-label={`Opsi ${LETTERS[i]} benar`}
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      onChange={() => setDraft({ choices: d.choices.map((x, k) => (q.type === 'single_choice' ? { ...x, correct: k === i } : k === i ? { ...x, correct: !x.correct } : x)) })}
                    />
                    <span className="w-5 font-heading text-sm font-bold">{LETTERS[i]}</span>
                    <Input value={c.label} onChange={(e) => setDraft({ choices: d.choices.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} placeholder={`Opsi ${LETTERS[i]}`} />
                    <Button size="icon" variant="ghost" aria-label="Hapus opsi" disabled={d.choices.length <= 2} onClick={() => setDraft({ choices: d.choices.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setDraft({ choices: [...d.choices, { label: '', correct: false }] })} disabled={d.choices.length >= 10}><Plus className="mr-1 h-4 w-4" /> Tambah opsi</Button>
              </>
            )}
            {q.type === 'true_false' && (
              <div className="flex gap-4 font-heading text-sm">
                {[true, false].map((b) => (
                  <label key={String(b)} className="flex items-center gap-2"><input type="radio" name="tf" checked={d.tf === b} onChange={() => setDraft({ tf: b })} className="h-4 w-4 accent-[hsl(var(--primary))]" /> {b ? 'Benar' : 'Salah'}</label>
                ))}
              </div>
            )}
            {q.type === 'short_answer' && (
              <div className="space-y-2">
                <Label htmlFor="acc">Jawaban yang diterima (satu per baris)</Label>
                <Textarea id="acc" rows={3} value={d.accepted} onChange={(e) => setDraft({ accepted: e.target.value })} placeholder={'translasi\ntranslation'} />
                <p className="text-xs text-muted-foreground">Huruf besar/kecil dan spasi berlebih diabaikan. Jawaban lain bisa dinilai manual dari halaman hasil.</p>
              </div>
            )}
            {q.type === 'essay' && <p className="text-sm text-muted-foreground">Esai tidak dinilai otomatis. Nilai jawaban peserta dari halaman hasil percobaan.</p>}
            {q.type === 'matching' && (
              <>
                <p className="text-sm text-muted-foreground">Tulis pasangan yang benar. Sisi kanan diacak saat ditampilkan.</p>
                {d.pairs.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                    <Input value={p.left} placeholder={`Kiri ${i + 1}`} onChange={(e) => setDraft({ pairs: d.pairs.map((x, k) => (k === i ? { ...x, left: e.target.value } : x)) })} />
                    <span aria-hidden="true">→</span>
                    <Input value={p.right} placeholder={`Kanan ${i + 1}`} onChange={(e) => setDraft({ pairs: d.pairs.map((x, k) => (k === i ? { ...x, right: e.target.value } : x)) })} />
                    <Button size="icon" variant="ghost" aria-label="Hapus pasangan" disabled={d.pairs.length <= 2} onClick={() => setDraft({ pairs: d.pairs.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setDraft({ pairs: [...d.pairs, { left: '', right: '' }] })}><Plus className="mr-1 h-4 w-4" /> Tambah pasangan</Button>
              </>
            )}
            {q.type === 'ordering' && (
              <>
                <p className="text-sm text-muted-foreground">Tulis butir dalam urutan yang benar. Urutan tampil untuk peserta diacak.</p>
                {d.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 font-heading text-sm font-bold">{i + 1}.</span>
                    <Input value={it} onChange={(e) => setDraft({ items: d.items.map((x, k) => (k === i ? e.target.value : x)) })} placeholder={`Butir ${i + 1}`} />
                    <Button size="icon" variant="ghost" aria-label="Hapus butir" disabled={d.items.length <= 2} onClick={() => setDraft({ items: d.items.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setDraft({ items: [...d.items, ''] })}><Plus className="mr-1 h-4 w-4" /> Tambah butir</Button>
              </>
            )}
            <div className="space-y-2 pt-2">
              <Label htmlFor="qe">Pembahasan</Label>
              <Textarea id="qe" rows={3} value={q.explanation ?? ''} onChange={(e) => set({ explanation: e.target.value })} placeholder="Ditampilkan sesuai pengaturan umpan balik kuis." />
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label>Materi terkait</Label>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border-[1.5px] p-2 font-heading text-sm">
                {materials.map((m) => (
                  <label key={m.id} className="flex items-start gap-2 rounded px-1 py-1 hover:bg-secondary">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={q.material_ids.includes(m.id)}
                      onChange={(e) => set({ material_ids: e.target.checked ? [...q.material_ids, m.id] : q.material_ids.filter((x) => x !== m.id) })} />
                    <span>{m.title}<span className="block text-xs text-muted-foreground">{m.course}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qto">Topik</Label>
              <Input id="qto" value={q.topic ?? ''} onChange={(e) => set({ topic: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qd">Tingkat kesulitan</Label>
              <select id="qd" className={sel} value={q.difficulty ?? ''} onChange={(e) => set({ difficulty: e.target.value || null })}>
                <option value="">–</option>
                {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qtag">Tag (pisahkan dengan koma)</Label>
              <Input id="qtag" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qm">URL gambar (opsional)</Label>
              <Input id="qm" value={q.media_url ?? ''} onChange={(e) => set({ media_url: e.target.value || null })} placeholder="https://…" />
            </div>
            <Button className="w-full" onClick={save} disabled={busy}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Simpan soal</Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
