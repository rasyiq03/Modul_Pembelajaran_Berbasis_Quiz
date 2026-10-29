import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, PageHeader } from '@/components/site/page-parts';
import { createSupabaseServer } from '@/lib/supabase/server';
import { QUIZ_MODE_LABEL, STATUS_LABEL, fmtDateTime } from '@/lib/labels';
import type { QuizMode, Status } from '@/lib/database.types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kuis · Admin' };

export default async function AdminQuizzesPage({ searchParams }: { searchParams: { archived?: string } }) {
  let q = createSupabaseServer().from('quizzes').select('id, title, mode, status, settings, updated_at, quiz_questions(question_id)').order('updated_at', { ascending: false });
  if (!searchParams.archived) q = q.neq('status', 'archived');
  const { data } = await q;
  const rows = (data ?? []) as unknown as { id: string; title: string; mode: QuizMode; status: Status; settings: { allow_guests?: boolean }; updated_at: string; quiz_questions: { question_id: string }[] }[];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Kuis"
        description="Susun kuis dari bank soal, atur mode, waktu, pengacakan, percobaan, dan umpan balik."
        actions={<>
          <Button asChild variant="ghost"><Link href={searchParams.archived ? '/admin/quizzes' : '/admin/quizzes?archived=1'}>{searchParams.archived ? 'Sembunyikan arsip' : 'Tampilkan arsip'}</Link></Button>
          <Button asChild><Link href="/admin/quizzes/new"><Plus className="mr-1 h-4 w-4" /> Kuis baru</Link></Button>
        </>}
      />
      {rows.length === 0 ? <EmptyState title="Belum ada kuis" description="Buat kuis pertama dari bank soal." /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Judul</TableHead><TableHead>Mode</TableHead><TableHead>Soal</TableHead><TableHead>Status</TableHead><TableHead>Diubah</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Link href={`/admin/quizzes/${r.id}`} className="text-foreground">{r.title}</Link>{r.settings?.allow_guests && <span className="ml-2 text-xs text-muted-foreground">tamu boleh</span>}</TableCell>
                  <TableCell>{QUIZ_MODE_LABEL[r.mode]}</TableCell>
                  <TableCell>{r.quiz_questions.length}</TableCell>
                  <TableCell><Badge variant={r.status === 'published' ? 'default' : 'secondary'}>{STATUS_LABEL[r.status]}</Badge></TableCell>
                  <TableCell>{fmtDateTime(r.updated_at)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right"><Link href={`/admin/results?quiz=${r.id}`}>Hasil</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
