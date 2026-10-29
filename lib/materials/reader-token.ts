import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token bertanda tangan untuk route pembaca /m/<token>/... .
 * Iframe materi berjalan di origin terisolasi (sandbox tanpa allow-same-origin), jadi permintaan aset
 * dari dalamnya tidak membawa cookie. Token di path-lah yang membuktikan akses, dan hanya diterbitkan
 * oleh server setelah akses diperiksa.
 */
export type ReaderKind = 'preview' | 'full';
export type ReaderClaims = { m: string; k: ReaderKind; u: string | null; e: number };

const TTL_SEC = 2 * 60 * 60;

function secret(): string {
  const s = process.env.MATERIAL_TOKEN_SECRET || '';
  if (s.length < 32) throw new Error('MATERIAL_TOKEN_SECRET belum diatur (minimal 32 karakter).');
  return s;
}

const b64url = (b: Buffer) => b.toString('base64url');
const sign = (body: string) => b64url(createHmac('sha256', secret()).update(body).digest());

export function issueReaderToken(materialId: string, kind: ReaderKind, userId: string | null): string {
  const claims: ReaderClaims = { m: materialId, k: kind, u: kind === 'full' ? userId : null, e: Math.floor(Date.now() / 1000) + TTL_SEC };
  const body = b64url(Buffer.from(JSON.stringify(claims)));
  return `${body}.${sign(body)}`;
}

export function verifyReaderToken(token: string): ReaderClaims | null {
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ReaderClaims;
    if (typeof c.m !== 'string' || (c.k !== 'preview' && c.k !== 'full') || typeof c.e !== 'number') return null;
    if (c.e < Math.floor(Date.now() / 1000)) return null;
    return c;
  } catch {
    return null;
  }
}

export const readerUrl = (token: string) => `/m/${token}/index.html`;
