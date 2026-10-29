import { getViewer } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { issueReaderToken, readerUrl } from '@/lib/materials/reader-token';

export type MaterialAccess = {
  hasAccess: boolean;
  reason: 'admin' | 'enrolled' | 'none';
  isRegistered: boolean;
  /** URL iframe: materi lengkap bila punya akses, selain itu preview (null bila belum diunggah) */
  readerSrc: string | null;
  showing: 'full' | 'preview' | null;
};

/**
 * FR-11/12/26: semua orang boleh melihat preview materi terpublikasi; HTML lengkap hanya untuk admin
 * dan pemilik enrollment aktif. Keputusan diambil di server; klien hanya menerima URL bertoken.
 */
export async function getMaterialAccess(material: { id: string; preview_path: string | null; content_path: string | null }): Promise<MaterialAccess> {
  const viewer = await getViewer();
  let reason: MaterialAccess['reason'] = 'none';
  if (viewer.isAdmin) reason = 'admin';
  else if (viewer.isRegistered) {
    const { data } = await createSupabaseServer().rpc('has_material_access', { p_material: material.id });
    if (data) reason = 'enrolled';
  }
  const hasAccess = reason !== 'none';
  if (hasAccess && material.content_path) {
    return { hasAccess, reason, isRegistered: viewer.isRegistered, showing: 'full', readerSrc: readerUrl(issueReaderToken(material.id, 'full', viewer.user!.id)) };
  }
  if (material.preview_path) {
    return { hasAccess, reason, isRegistered: viewer.isRegistered, showing: 'preview', readerSrc: readerUrl(issueReaderToken(material.id, 'preview', null)) };
  }
  return { hasAccess, reason, isRegistered: viewer.isRegistered, showing: null, readerSrc: null };
}
