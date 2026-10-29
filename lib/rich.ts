/**
 * Teks soal/opsi/pembahasan boleh memuat tag format sederhana (<b>, <i>, <sub>, <sup>, <code>, …)
 * seperti di materi. Semua lainnya di-escape, dan tag yang diizinkan tidak boleh punya atribut,
 * sehingga teks dari bank soal atau impor CSV tidak bisa menyisipkan skrip (XSS).
 */
const ALLOWED = /&lt;(\/?)(b|i|em|strong|sub|sup|code|u|small|mark)&gt;/g;

export function rich(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
    .replace(ALLOWED, '<$1$2>')
    .replace(/&lt;br\s*\/?&gt;/g, '<br>');
}

export const plain = (s: string | null | undefined) => String(s ?? '').replace(/<[^>]*>/g, '');
