import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { toCsv } from '@/lib/csv';
import { CSV_COLUMNS, questionToRow } from '@/lib/question-csv';
import type { QuestionType, Status } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

/** FR-35: ekspor bank soal (dengan filter yang sama dengan daftar) ke CSV yang bisa diimpor ulang */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return new NextResponse('Hanya admin.', { status: 403 });
  const sp = req.nextUrl.searchParams;
  const supabase = createSupabaseServer();
  let q = supabase
    .from('questions')
    .select('id, type, prompt, media_url, topic, difficulty, status, source_ref, question_options(key, label, side, display_order), question_keys(answer, explanation), question_materials' + (sp.get('material') ? '!inner' : '') + '(material_id, materials(slug, courses(slug))), question_tags(tag)')
    .order('created_at')
    .limit(5000);
  if (sp.get('q')) q = q.ilike('prompt', `%${sp.get('q')!.replace(/[%_]/g, '')}%`);
  if (sp.get('type')) q = q.eq('type', sp.get('type') as QuestionType);
  if (sp.get('status')) q = q.eq('status', sp.get('status') as Status);
  if (sp.get('material')) q = q.eq('question_materials.material_id', sp.get('material')!);
  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });

  type Row = {
    type: QuestionType; prompt: string; media_url: string | null; topic: string | null; difficulty: string | null; status: string; source_ref: string | null;
    question_options: { key: string; label: string; side: 'left' | 'right' | null; display_order: number }[];
    question_keys: { answer: unknown; explanation: string | null } | null;
    question_materials: { materials: { slug: string; courses: { slug: string } | null } | null }[];
    question_tags: { tag: string }[];
  };
  const rows = (data as unknown as Row[]).map((r) => {
    /* Opsi diekspor dalam urutan kunci (untuk mengurutkan: urutan benar) agar impor ulang tetap sama */
    const order: string[] | undefined = (r.question_keys?.answer as { order?: string[] } | undefined)?.order;
    const opts = [...r.question_options].sort((a, b) =>
      order ? order.indexOf(a.key) - order.indexOf(b.key) : a.side === b.side ? a.key.localeCompare(b.key, undefined, { numeric: true }) : a.side === 'left' ? -1 : 1);
    return questionToRow({
      ...r, options: opts, answer: r.question_keys?.answer, explanation: r.question_keys?.explanation ?? null,
      materials: r.question_materials.map((m) => `${m.materials?.courses?.slug}/${m.materials?.slug}`),
      tags: r.question_tags.map((t) => t.tag),
    });
  });
  return new NextResponse(toCsv([[...CSV_COLUMNS], ...rows]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bank-soal-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
