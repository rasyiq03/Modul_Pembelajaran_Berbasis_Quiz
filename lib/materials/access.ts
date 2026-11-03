import { getViewer } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getViewerTier } from '@/lib/subscriptions';
import { accessLevel, type ViewerTier } from '@/lib/access';
import { issueReaderToken, readerUrl } from '@/lib/materials/reader-token';
import type { AccessLevel } from '@/lib/database.types';

export type MaterialAccess = {
  level: AccessLevel;
  tier: ViewerTier;
  /** Boleh membaca materi lengkap (diputuskan database: has_material_access) */
  canRead: boolean;
  /** Yang tampil di pembaca; null bila belum ada berkas yang bisa ditampilkan */
  showing: 'full' | 'preview' | null;
  /** URL iframe bertoken, diterbitkan hanya setelah akses diperiksa */
  readerSrc: string | null;
};

/**
 * Materi lengkap terbuka sesuai tingkat aksesnya (terbuka, wajib masuk, langganan); selain itu
 * pratinjau. Keputusan diambil di server; klien hanya menerima URL bertoken.
 */
export async function getMaterialAccess(material: {
  id: string; access_level?: AccessLevel | null; preview_path: string | null; content_path: string | null;
}): Promise<MaterialAccess> {
  const [viewer, tier, { data }] = await Promise.all([
    getViewer(),
    getViewerTier(),
    createSupabaseServer().rpc('has_material_access', { p_material: material.id }),
  ]);
  const level = accessLevel(material.access_level);
  const canRead = data === true;
  const base = { level, tier, canRead };
  if (canRead && material.content_path) {
    const userId = viewer.isRegistered ? viewer.user!.id : null;
    return { ...base, showing: 'full', readerSrc: readerUrl(issueReaderToken(material.id, 'full', userId)) };
  }
  if (material.preview_path) {
    return { ...base, showing: 'preview', readerSrc: readerUrl(issueReaderToken(material.id, 'preview', null)) };
  }
  return { ...base, showing: null, readerSrc: null };
}
