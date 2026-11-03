import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { buildPreview } from '@/lib/materials/preview.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Buat (ulang) pratinjau otomatis dari HTML lengkap yang sudah diunggah. Memakai sesi admin sendiri:
 * kebijakan Storage mengizinkan admin membaca dan menulis bucket "materials".
 */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const viewer = await getViewer();
  if (!viewer.isAdmin) return fail(403, 'Hanya admin.');
  const db = createSupabaseServer();
  const { data: m } = await db.from('materials').select('id, content_path').eq('id', params.id).maybeSingle();
  if (!m) return fail(404, 'Materi tidak ditemukan.');
  if (!m.content_path) return fail(400, 'Unggah HTML lengkap dulu.');

  const { data: file, error } = await db.storage.from('materials').download(`${m.content_path}/index.html`);
  if (error || !file) return fail(404, 'HTML lengkap tidak ditemukan di Storage.');
  const preview = buildPreview(await file.text());
  if (!preview) return fail(422, 'HTML ini bukan format materi StudyStudio, jadi pratinjau tidak bisa dibuat otomatis. Unggah HTML pratinjau sendiri.');

  const path = `${m.id}/preview/index.html`;
  const up = await db.storage.from('materials').upload(path, new Blob([preview], { type: 'text/html; charset=utf-8' }), {
    upsert: true, contentType: 'text/html; charset=utf-8',
  });
  if (up.error) return fail(500, up.error.message);
  const { error: e2 } = await db.from('materials').update({ preview_path: `${m.id}/preview` }).eq('id', m.id);
  if (e2) return fail(500, e2.message);
  return NextResponse.json({ ok: true });
}
