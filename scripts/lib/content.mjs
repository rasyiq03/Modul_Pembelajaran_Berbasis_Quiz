/**
 * Pembaca konten materi (content/) bersama untuk skrip pemeliharaan dan impor.
 *
 * Struktur:
 *   content/courses.json                       daftar mata kuliah (slug = nama folder)
 *   content/engine/kuiskelas.{js,css}          sumber tunggal mesin materi offline
 *   content/materials/<course-slug>/<file>.html  satu file HTML mandiri per materi
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const CONTENT = join(ROOT, 'content');
export const MATERIALS_DIR = join(CONTENT, 'materials');
export const ENGINE_JS = join(CONTENT, 'engine', 'kuiskelas.js');
export const ENGINE_CSS = join(CONTENT, 'engine', 'kuiskelas.css');

export const CSS_MARK = '<!-- KUISKELAS:ENGINE-CSS -->';
export const JS_MARK = '<!-- KUISKELAS:ENGINE-JS -->';
/* Blok <style>/<script> mesin dikenali dari komentar pembukanya, dengan atau tanpa penanda di atasnya */
export const CSS_RE = /(?:<!-- KUISKELAS:ENGINE-CSS -->\s*)?<style>\s*\/\*! KuisKelas engine CSS v[^<]*?<\/style>/s;
export const JS_RE = /(?:<!-- KUISKELAS:ENGINE-JS -->\s*)?<script>\s*\/\*!\s*\n \* KuisKelas engine v.*?<\/script>/s;

export const read = (p) => readFileSync(p, 'utf8');

export function loadCourses() {
  return JSON.parse(read(join(CONTENT, 'courses.json'))).courses;
}

/** Semua file materi, berurutan per mata kuliah lalu nama file. */
export function listMaterialFiles() {
  const out = [];
  for (const dir of readdirSync(MATERIALS_DIR).sort()) {
    const full = join(MATERIALS_DIR, dir);
    if (!statSync(full).isDirectory()) continue;
    for (const f of readdirSync(full).sort()) {
      if (f.endsWith('.html')) out.push({ course: dir, file: f, path: join(full, f), rel: relative(ROOT, join(full, f)) });
    }
  }
  return out;
}

export function engineBlocks() {
  const css = read(ENGINE_CSS).trimEnd() + '\n';
  const js = read(ENGINE_JS).trimEnd() + '\n';
  return { css: `${CSS_MARK}\n<style>\n${css}</style>`, js: `${JS_MARK}\n<script>\n${js}\n</script>` };
}

/** Ganti blok mesin di HTML materi dengan versi terbaru. null bila file tidak memakai mesin KuisKelas. */
export function withEngine(html) {
  if (!CSS_RE.test(html) || !JS_RE.test(html)) return null;
  const { css, js } = engineBlocks();
  return html.replace(CSS_RE, () => css).replace(JS_RE, () => js);
}

/**
 * Baca window.COURSE dan metadata materi. Hanya blok data soal yang dievaluasi, di konteks vm
 * kosong dengan batas waktu (bukan skrip aplikasi materi).
 */
export function parseMaterial(html, rel = '') {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, basename(rel, '.html')])[1].replace(/\s+/g, ' ').trim();
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const code = scripts.find((s) => /window\.COURSE\s*=/.test(s));
  if (!code) throw new Error(`${rel}: tidak ada window.COURSE`);
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { timeout: 1000 });
  const course = JSON.parse(JSON.stringify(sandbox.window.COURSE || null));
  if (!course || !Array.isArray(course.questions)) throw new Error(`${rel}: window.COURSE.questions tidak valid`);

  const lede = (html.match(/<p class="lede">([\s\S]*?)<\/p>/) || [])[1];
  const sections = [...html.matchAll(/<section id="([\w-]+)"(?: [^>]*?data-toc="([^"]*)")?[^>]*>/g)]
    .filter((m) => m[1] !== 'bank-soal')
    .map((m) => ({ id: m[1], label: m[2] || m[1] }));
  const { checkpoints, labs } = progressTargets(html);
  return {
    checkpoints,
    labs,
    title: title.replace(/\s*[:|]\s*Rangkuman dan Kuis( Kahoot)?$/i, ''),
    id: course.id || '',
    short: course.short || '',
    longTitle: course.title || '',
    description: lede ? stripTags(lede) : '',
    sections,
    questions: course.questions,
  };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const stripTags = (s) => String(s).replace(/<[^>]*>/g, '')
  .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10)) : ENTITIES[e.toLowerCase()] ?? m)
  .replace(/\s+/g, ' ').trim();

/** Slug materi dari nama file: "stat-04-diagram-pohon.html" → "stat-04-diagram-pohon" */
export const materialSlug = (file) => basename(file, '.html').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const attr = (tag, name) => {
  /* Nama atribut utuh: data-lab tidak boleh cocok dengan data-labels */
  const m = tag.match(new RegExp(`\\s${name}(?=[\\s=/>]|$)(?:\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+)))?`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
};

/**
 * Bab & lab yang dilacak mesin (content/engine/kuiskelas.js, enhanceSummary), dengan aturan yang sama:
 * - bab: <section id> anak langsung <article> di #view-summary, tanpa data-nocheck dan bukan bank soal;
 * - lab: elemen ber-class "lab" atau ber-atribut data-lab di #view-summary, tanpa data-noxp;
 *   id = data-lab || id || "lab<urutan>", label = judul h2–h4 pertama di dalamnya.
 * Platform hanya menerima progres untuk id di daftar ini (materials.sections / materials.labs).
 */
export function progressTargets(html) {
  const start = html.indexOf('<main id="view-summary"');
  if (start < 0) return { checkpoints: [], labs: [] };
  const end = html.indexOf('</main>', start);
  const main = html.slice(start, end < 0 ? undefined : end)
    .replace(/<script[\s\S]*?<\/script>/gi, (m) => ' '.repeat(m.length))
    .replace(/<style[\s\S]*?<\/style>/gi, (m) => ' '.repeat(m.length))
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));

  /* Bab: telusuri tag untuk tahu kedalaman relatif terhadap <article> */
  const checkpoints = [];
  const tagRe = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const stack = [];
  let m;
  const open = [];   // bab yang sedang terbuka: { id, label, depth, nocheck, bank }
  while ((m = tagRe.exec(main))) {
    const [, close, rawName, rest] = m;
    const name = rawName.toLowerCase();
    if (VOID.has(name) || rest.endsWith('/')) continue;
    if (!close) {
      const parent = stack[stack.length - 1];
      stack.push(name);
      if (name === 'section' && parent === 'article') {
        const id = attr(rest, 'id');
        if (id) open.push({ id, label: attr(rest, 'data-toc'), depth: stack.length, nocheck: attr(rest, 'data-nocheck') !== null, bank: false, start: m.index });
      }
      if (attr(rest, 'id') === 'bank') open.forEach((o) => { o.bank = true; });
    } else {
      const i = stack.lastIndexOf(name);
      if (i < 0) continue;
      const depth = stack.length;
      stack.length = i;
      if (name === 'section') {
        const o = open[open.length - 1];
        if (o && o.depth === depth) {
          open.pop();
          if (!o.nocheck && !o.bank) {
            const h2 = main.slice(o.start, m.index).match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            checkpoints.push({ id: o.id, label: o.label || (h2 ? stripTags(h2[1]) : o.id) });
          }
        }
      }
    }
  }

  /* Lab: urutan dokumen seperti querySelectorAll('.lab, [data-lab]') */
  const labs = [];
  let n = 0;
  const openRe = /<([a-zA-Z][\w-]*)(\s[^>]*)?>/g;
  while ((m = openRe.exec(main))) {
    const rest = m[2] || '';
    const cls = (attr(rest, 'class') || '').split(/\s+/);
    const dataLab = attr(rest, 'data-lab');
    if (!cls.includes('lab') && dataLab === null) continue;
    n++;
    if (attr(rest, 'data-noxp') !== null) continue;
    const id = dataLab || attr(rest, 'id') || 'lab' + n;
    const h = main.slice(m.index).match(/<h([234])[^>]*>([\s\S]*?)<\/h\1>/i);
    labs.push({ id, label: h ? stripTags(h[2]).slice(0, 80) : 'Lab ' + n });
  }
  return { checkpoints, labs };
}
