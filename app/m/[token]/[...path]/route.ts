import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseService } from '@/lib/supabase/server';
import { verifyReaderToken } from '@/lib/materials/reader-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', pdf: 'application/pdf',
  csv: 'text/csv; charset=utf-8', txt: 'text/plain; charset=utf-8',
};

/* Dokumen materi selalu dijalankan di origin buram: skrip & form boleh, tetapi tidak bisa membaca
   cookie/sesi web ini meskipun URL-nya dibuka langsung di tab baru. */
const SANDBOX = 'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';

const deny = (status: number, msg: string) =>
  new NextResponse(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function GET(_req: NextRequest, { params }: { params: { token: string; path: string[] } }) {
  const claims = verifyReaderToken(params.token);
  if (!claims) return deny(403, 'Tautan materi tidak valid atau sudah kedaluwarsa. Muat ulang halaman materi.');

  /* Tolak path traversal dan segmen aneh */
  let segs: string[];
  try { segs = (params.path || []).map((s) => decodeURIComponent(s)); } catch { return deny(400, 'Path tidak valid.'); }
  if (!segs.length || segs.some((s) => !s || s === '.' || s === '..' || s.includes('/') || s.includes('\\') || s.startsWith('.'))) {
    return deny(400, 'Path tidak valid.');
  }

  const db = createSupabaseService();
  const { data } = await db
    .from('materials')
    .select('id, status, preview_path, content_path, courses(status)')
    .eq('id', claims.m)
    .maybeSingle();
  const m = data as unknown as {
    id: string; status: string; preview_path: string | null; content_path: string | null; courses: { status: string } | null;
  } | null;
  if (!m) return deny(404, 'Materi tidak ditemukan.');

  const folder = claims.k === 'full' ? m.content_path : m.preview_path;
  if (!folder) return deny(404, 'Isi materi belum diunggah.');
  const published = m.status === 'published' && m.courses?.status === 'published';

  if (claims.k === 'full') {
    /* Token berumur pendek, tetapi akses tetap diperiksa ulang agar pencabutan berlaku seketika */
    const uid = claims.u;
    if (!uid) return deny(403, 'Akses ditolak.');
    const [{ data: prof }, { data: enr }] = await Promise.all([
      db.from('profiles').select('role').eq('id', uid).maybeSingle(),
      db.from('enrollments').select('id').eq('user_id', uid).eq('material_id', m.id).eq('revoked', false).maybeSingle(),
    ]);
    if (prof?.role !== 'admin') {
      if (!enr) return deny(403, 'Akses ke materi lengkap sudah dicabut.');
      /* Sama dengan RLS halaman materi: peserta hanya membaca materi yang terpublikasi */
      if (!published) return deny(404, 'Materi belum dipublikasikan.');
    }
  } else if (!published) {
    return deny(404, 'Materi belum dipublikasikan.');
  }

  const objectPath = `${folder}/${segs.join('/')}`;
  const { data: file, error } = await db.storage.from('materials').download(objectPath);
  if (error || !file) return deny(404, 'Berkas tidak ditemukan.');

  const ext = (segs[segs.length - 1].split('.').pop() || '').toLowerCase();
  return new NextResponse(file.stream(), {
    headers: {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Content-Security-Policy': SANDBOX,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
