/**
 * Pratinjau materi otomatis, dipakai `npm run content:import` dan Admin → Materi.
 *
 * Pratinjau adalah dokumen materi asli dengan mesin materi tetap aktif, jadi tampil persis seperti
 * materi lengkap (header, tab, daftar isi, penjelajah, kuis). Bedanya:
 *   - hanya bagian pertama yang terbuka; bagian lain diganti kerangka terkunci yang judulnya tetap
 *     muncul di daftar isi,
 *   - window.COURSE.questions dipangkas menjadi beberapa soal contoh, diutamakan soal untuk bagian
 *     yang terbuka.
 * Isi bagian terkunci dan soal lainnya tidak ikut terkirim. Tidak ada kode materi yang dievaluasi
 * (daftar soal dipangkas secara tekstual), jadi aman dijalankan di server untuk HTML unggahan admin.
 */

const BANK_ID = 'bank-soal';

const STYLE = `<style id="kk-preview-style">
.kk-preview-badge{display:inline-block;margin:0 0 12px;padding:3px 10px;border-radius:999px;background:var(--warn,#FBF3D9);border:1.5px solid var(--warn-line,#C99A1B);font:700 .72rem var(--font-head,system-ui);letter-spacing:.08em;text-transform:uppercase}
.kk-preview-note{margin:28px 0;padding:18px 20px;border:1.5px solid var(--warn-line,#C99A1B);background:var(--warn,#FBF3D9);border-radius:8px;font-family:var(--font-head,system-ui);font-size:.92rem;line-height:1.6}
.kk-preview-note b{display:block;font-size:1rem;margin-bottom:4px}
.kk-locked h2{opacity:.55}
.kk-locked .kk-lock{display:flex;gap:10px;align-items:center;margin:14px 0 0;padding:16px 18px;border:1.5px dashed var(--line,#D9DCEC);border-radius:8px;color:var(--muted,#5B6285);font:600 .9rem var(--font-head,system-ui)}
.kk-locked .kk-lock::before{content:"";flex:none;width:18px;height:18px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='4' y='11' width='16' height='10' rx='2'/%3E%3Cpath d='M8 11V7a4 4 0 0 1 8 0v4'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='4' y='11' width='16' height='10' rx='2'/%3E%3Cpath d='M8 11V7a4 4 0 0 1 8 0v4'/%3E%3C/svg%3E") center/contain no-repeat}
</style>`;

const stripTags = (s) => String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];

/** Section tingkat teratas di dalam `inner` (sadar sarang): [{ start, end, openTag, id }] */
function topSections(inner) {
  const out = [];
  let depth = 0;
  let cur = null;
  for (const m of inner.matchAll(/<(\/?)section\b[^>]*>/g)) {
    if (m[1]) {
      depth--;
      if (depth === 0 && cur) { cur.end = m.index + m[0].length; out.push(cur); cur = null; }
    } else {
      if (depth === 0) cur = { start: m.index, openTag: m[0], id: attr(m[0], 'id') };
      depth++;
    }
  }
  return out;
}

/**
 * Indeks akhir larik yang dibuka `[` di `src[open]`, beserta rentang tiap elemen tingkat teratas.
 * Memahami string ('…', "…", `…`), komentar, dan kurung bersarang. null bila tidak seimbang.
 */
function scanArray(src, open) {
  const items = [];
  let depth = 0;
  let itemStart = -1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return null; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; if (i <= 0) return null; continue; }
    if (c === '[' || c === '{' || c === '(') {
      depth++;
      if (depth === 2 && itemStart < 0) itemStart = i;
    } else if (c === ']' || c === '}' || c === ')') {
      depth--;
      if (depth === 1 && itemStart >= 0) { items.push([itemStart, i + 1]); itemStart = -1; }
      if (depth === 0) return { end: i, items };
    }
  }
  return null;
}

/** Ganti larik `questions: [...]` di skrip window.COURSE dengan soal contoh. null bila formatnya tak dikenali. */
function trimQuestions(code, openIds, max) {
  const m = /\bquestions\s*:\s*\[/.exec(code);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const scan = scanArray(code, open);
  if (!scan) return null;
  const items = scan.items.map(([s, e]) => code.slice(s, e));
  if (items.some((t) => !t.startsWith('{'))) return null;
  const ref = (t) => (t.match(/\bref\s*:\s*["']([\w-]+)["']/) || [])[1];
  const picked = [
    ...items.filter((t) => openIds.has(ref(t))),
    ...items.filter((t) => !ref(t)),
    ...items.filter((t) => ref(t) && !openIds.has(ref(t))),
  ].slice(0, max);
  /* Pertahankan urutan asli agar soal contoh tetap mengikuti alur bab */
  const chosen = items.filter((t) => picked.includes(t));
  return { code: code.slice(0, open) + '[\n    ' + chosen.join(',\n    ') + '\n  ]' + code.slice(scan.end + 1), total: items.length, kept: chosen.length };
}

/**
 * @param {string} html  HTML lengkap materi berformat mesin materi (content/engine)
 * @param {{ openSections?: number, sampleQuestions?: number }} [opts]
 * @returns {string | null} HTML pratinjau, atau null bila HTML bukan format materi berbasis mesin
 */
export function buildPreview(html, opts = {}) {
  const openSections = opts.openSections ?? 1;
  const sampleQuestions = opts.sampleQuestions ?? 5;

  const mainAt = html.search(/<main id="view-summary"/);
  const artOpen = /<article\b[^>]*>/.exec(html.slice(mainAt));
  if (mainAt < 0 || !artOpen) return null;
  const innerStart = mainAt + artOpen.index + artOpen[0].length;
  const innerEnd = html.indexOf('</article>', innerStart);
  if (innerEnd < 0) return null;
  const inner = html.slice(innerStart, innerEnd);

  const sections = topSections(inner);
  const content = sections.filter((s) => s.id && s.id !== BANK_ID);
  if (!content.length) return null;
  const open = content.slice(0, openSections);
  const openIds = new Set(open.map((s) => s.id));

  /* window.COURSE: pangkas soal sebelum apa pun diubah; gagal → tidak ada pratinjau (lebih aman daripada bocor) */
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const courseScript = scripts.find((s) => /window\.COURSE\s*=/.test(s[1]));
  let total = 0;
  let kept = 0;
  let out = html;
  if (courseScript) {
    const trimmed = trimQuestions(courseScript[1], openIds, sampleQuestions);
    if (!trimmed) return null;
    ({ total, kept } = trimmed);
    const at = courseScript.index + '<script>'.length;
    out = out.slice(0, at) + trimmed.code + out.slice(at + courseScript[1].length);
  }
  /* Indeks article bergeser bila skrip COURSE ada sebelum article (tidak lazim, tetapi aman) */
  const shift = courseScript && courseScript.index < innerStart ? out.length - html.length : 0;

  const lockedCount = content.length - open.length;
  let body = '';
  let cursor = 0;
  for (const s of sections) {
    body += inner.slice(cursor, s.start);
    cursor = s.end;
    const original = inner.slice(s.start, s.end);
    if (s.id === BANK_ID) {
      body += `<section id="${BANK_ID}" data-nocheck data-toc="Contoh soal">
  <h2>Contoh soal beserta kunci</h2>
  <p>Pratinjau memuat ${kept} dari ${total} soal. Ketuk soal untuk melihat kunci dan pembahasan, atau buka tab <b>Kuis</b> untuk mencobanya.</p>
  <div id="bank"></div>
  <p style="margin-top:22px"><button class="kq-btn" style="background:#46178F" data-go-quiz>Coba kuis contoh</button></p>
</section>`;
    } else if (!s.id || openIds.has(s.id)) {
      body += original;
      if (s.id === open[open.length - 1].id && lockedCount > 0) {
        body += `\n<div class="kk-preview-note"><b>Ini pratinjau materi.</b>Materi lengkap berisi ${content.length} bagian` +
          `${total ? ` dan ${total} soal latihan` : ''}. ${lockedCount} bagian berikutnya terkunci; bukalah materi lengkap di StudyStudio untuk membacanya.</div>`;
      }
    } else {
      const toc = attr(s.openTag, 'data-toc');
      const h2 = (original.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/) || [])[1];
      const title = h2 ? esc(stripTags(h2)) : toc || esc(s.id);
      body += `<section id="${s.id}"${toc != null ? ` data-toc="${toc}"` : ''} data-nocheck class="kk-locked">
  <h2>${title}</h2>
  <p class="kk-lock">Bagian ini terkunci di pratinjau.</p>
</section>`;
    }
  }
  body += inner.slice(cursor);

  out = out.slice(0, innerStart + shift) + body + out.slice(innerEnd + shift);
  out = out.replace(/<div class="hero">/, '<div class="hero">\n      <p class="kk-preview-badge">Pratinjau</p>');
  return out.replace('</head>', `${STYLE}\n</head>`);
}
