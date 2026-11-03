/** CSV sederhana (RFC 4180): koma, kutip ganda, baris baru di dalam sel. */

/**
 * guardFormulas: untuk CSV berisi teks dari peserta (nama, nickname). Teks yang diawali = + - @
 * diberi awalan ' agar Excel/Sheets tidak menjalankannya sebagai rumus (CSV injection).
 * Jangan dipakai untuk CSV yang akan diimpor ulang (bank soal), karena isinya ikut berubah.
 */
export function toCsv(rows: (string | number | boolean | null | undefined)[][], opts: { guardFormulas?: boolean } = {}): string {
  const cell = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (opts.guardFormulas && typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM agar Excel membaca UTF-8 dengan benar
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/** Baris CSV → objek berdasarkan header (nama kolom huruf kecil) */
export function csvObjects(text: string): Record<string, string>[] {
  const [head, ...body] = parseCsv(text);
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}
