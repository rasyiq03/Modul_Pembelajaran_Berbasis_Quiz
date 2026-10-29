import Link from 'next/link';
import { Download, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, PageHeader } from '@/components/site/page-parts';
import { QuestionRowActions } from '@/components/admin/question-row-actions';
import { QuestionImport } from '@/components/admin/question-import';
import { createSupabaseServer } from '@/lib/supabase/server';
import { materialOptions } from '@/lib/admin/materials';
import { QUESTION_TYPES, QUESTION_TYPE_LABEL, STATUS_LABEL } from '@/lib/labels';
import type { QuestionType, Status } from '@/lib/database.types';
import { plain } from '@/lib/rich';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bank soal · Admin' };
const PAGE = 50;

type SP = { q?: string; type?: string; status?: string; material?: string; page?: string };

export default async function AdminQuestionsPage({ searchParams }: { searchParams: SP }) {
  const supabase = createSupabaseServer();
  const materials = await materialOptions();
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);

  let query = supabase
    .from('questions')
    .select('id, type, prompt, status, topic, difficulty, updated_at, question_materials' + (searchParams.material ? '!inner' : '') + '(material_id), quiz_questions(quiz_id)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (searchParams.q) query = query.ilike('prompt', `%${searchParams.q.replace(/[%_]/g, '')}%`);
  if (searchParams.type && QUESTION_TYPES.includes(searchParams.type as QuestionType)) query = query.eq('type', searchParams.type as QuestionType);
  if (searchParams.status) query = query.eq('status', searchParams.status as Status);
  else query = query.neq('status', 'archived');
  if (searchParams.material) query = query.eq('question_materials.material_id', searchParams.material);
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as {
    id: string; type: QuestionType; prompt: string; status: Status; topic: string | null; updated_at: string;
    question_materials: { material_id: string }[]; quiz_questions: { quiz_id: string }[];
  }[];
  const matTitle = new Map(materials.map((m) => [m.id, m.title]));
  const exportQs = new URLSearchParams(Object.entries(searchParams).filter(([k, v]) => v && k !== 'page') as [string, string][]).toString();
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const link = (p: number) => `/admin/questions?${new URLSearchParams({ ...searchParams, page: String(p) } as Record<string, string>).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank soal"
        description="Soal kanonis yang dipakai ulang di banyak kuis. Satu soal bisa terkait dengan beberapa materi."
        actions={<>
          <QuestionImport materials={materials} />
          <Button asChild variant="outline"><a href={`/admin/questions/export?${exportQs}`}><Download className="mr-1 h-4 w-4" /> Ekspor CSV</a></Button>
          <Button asChild><Link href={`/admin/questions/new${searchParams.material ? `?material=${searchParams.material}` : ''}`}><Plus className="mr-1 h-4 w-4" /> Soal baru</Link></Button>
        </>}
      />

      <form className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_2fr_auto]" action="/admin/questions">
        <input name="q" defaultValue={searchParams.q} placeholder="Cari teks soal" aria-label="Cari teks soal" className="h-10 rounded-md border-[1.5px] border-input bg-background px-3 font-heading text-sm" />
        <select name="type" defaultValue={searchParams.type ?? ''} aria-label="Jenis soal" className="h-10 rounded-md border-[1.5px] border-input bg-background px-3 font-heading text-sm">
          <option value="">Semua jenis</option>
          {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>)}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ''} aria-label="Status" className="h-10 rounded-md border-[1.5px] border-input bg-background px-3 font-heading text-sm">
          <option value="">Draf & terpublikasi</option>
          {(['draft', 'published', 'archived'] as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select name="material" defaultValue={searchParams.material ?? ''} aria-label="Materi" className="h-10 rounded-md border-[1.5px] border-input bg-background px-3 font-heading text-sm">
          <option value="">Semua materi</option>
          {materials.map((m) => <option key={m.id} value={m.id}>{m.course} · {m.title}</option>)}
        </select>
        <Button type="submit" variant="outline">Terapkan</Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Tidak ada soal" description="Buat soal baru, impor CSV, atau jalankan npm run content:import untuk memuat soal dari materi." />
      ) : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead className="w-[45%]">Soal</TableHead><TableHead>Jenis</TableHead><TableHead>Materi</TableHead><TableHead>Status</TableHead><TableHead>Kuis</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Link href={`/admin/questions/${r.id}`} className="line-clamp-2 text-foreground">{plain(r.prompt)}</Link>{r.topic && <span className="text-xs text-muted-foreground">{r.topic}</span>}</TableCell>
                  <TableCell className="whitespace-nowrap">{QUESTION_TYPE_LABEL[r.type]}</TableCell>
                  <TableCell className="max-w-[14rem] truncate text-xs">{r.question_materials.map((m) => matTitle.get(m.material_id)).filter(Boolean).join(', ') || '–'}</TableCell>
                  <TableCell><Badge variant={r.status === 'published' ? 'default' : 'secondary'}>{STATUS_LABEL[r.status]}</Badge></TableCell>
                  <TableCell>{new Set(r.quiz_questions.map((x) => x.quiz_id)).size}</TableCell>
                  <TableCell><QuestionRowActions id={r.id} status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      <div className="flex items-center justify-between font-heading text-sm text-muted-foreground">
        <span>{count ?? 0} soal</span>
        {pages > 1 && <span className="flex gap-3">{page > 1 && <Link href={link(page - 1)}>← Sebelumnya</Link>} Halaman {page}/{pages} {page < pages && <Link href={link(page + 1)}>Berikutnya →</Link>}</span>}
      </div>
    </div>
  );
}
