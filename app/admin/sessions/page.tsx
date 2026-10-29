import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, PageHeader } from '@/components/site/page-parts';
import { CreateSession } from '@/components/admin/create-session';
import { createSupabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/labels';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sesi live · Admin' };

const STATUS: Record<string, string> = { waiting: 'Menunggu', active: 'Berjalan', completed: 'Selesai', cancelled: 'Dibatalkan' };

export default async function AdminSessionsPage({ searchParams }: { searchParams: { quiz?: string } }) {
  const supabase = createSupabaseServer();
  const [{ data: sessions }, { data: quizzes }] = await Promise.all([
    supabase.from('quiz_sessions').select('id, code, status, created_at, quizzes(title), quiz_participants(id)').order('created_at', { ascending: false }).limit(100),
    supabase.from('quizzes').select('id, title, mode, status, settings').neq('status', 'archived').order('title'),
  ]);
  const rows = (sessions ?? []) as unknown as { id: string; code: string; status: string; created_at: string; quizzes: { title: string } | null; quiz_participants: { id: string }[] }[];

  return (
    <div className="space-y-6">
      <PageHeader title="Sesi live" description="Buat sesi dengan kode untuk kuis apa pun, tampilkan di proyektor, dan pandu peserta soal demi soal." />
      <CreateSession quizzes={(quizzes ?? []).map((q) => ({ id: q.id, title: q.title, mode: q.mode, status: q.status, settings: q.settings }))} defaultQuiz={searchParams.quiz} />
      {rows.length === 0 ? (
        <EmptyState title="Belum ada sesi" description="Sesi yang kamu buat akan tampil di sini." />
      ) : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Kuis</TableHead><TableHead>Status</TableHead><TableHead>Peserta</TableHead><TableHead>Dibuat</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-heading font-extrabold tracking-widest">{r.code}</TableCell>
                  <TableCell>{r.quizzes?.title ?? '–'}</TableCell>
                  <TableCell><Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{STATUS[r.status] ?? r.status}</Badge></TableCell>
                  <TableCell>{r.quiz_participants.length}</TableCell>
                  <TableCell>{fmtDateTime(r.created_at)}</TableCell>
                  <TableCell><Link href={`/admin/sessions/${r.id}`}>{r.status === 'completed' || r.status === 'cancelled' ? 'Hasil' : 'Buka konsol'}</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
