import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { quizAttempts } from '@/lib/admin/results';
import { toCsv } from '@/lib/csv';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = { in_progress: 'sedang dikerjakan', submitted: 'menunggu penilaian', graded: 'dinilai' };

/** FR-67: unduh hasil kuis sebagai CSV */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return new NextResponse('Hanya admin.', { status: 403 });
  const quizId = req.nextUrl.searchParams.get('quiz');
  if (!quizId) return new NextResponse('Parameter quiz wajib.', { status: 400 });
  const { data: quiz } = await createSupabaseServer().from('quizzes').select('title').eq('id', quizId).maybeSingle();
  const rows = await quizAttempts(quizId, 10000);
  const csv = toCsv([
    ['Nama', 'Email', 'Tamu', 'Status', 'Skor', 'Skor maks', 'Persen', 'Lulus', 'Terlambat', 'Mulai', 'Selesai', 'ID percobaan'],
    ...rows.map((r) => [r.name ?? '', r.email ?? '', r.is_guest ? 'ya' : 'tidak', STATUS[r.status] ?? r.status, r.score, r.max_score, r.percent, r.passed ? 'ya' : 'tidak', r.late ? 'ya' : 'tidak', r.started_at, r.finished_at ?? '', r.id]),
  ]);
  const slug = (quiz?.title ?? 'kuis').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="hasil-${slug}.csv"`, 'Cache-Control': 'no-store' },
  });
}
