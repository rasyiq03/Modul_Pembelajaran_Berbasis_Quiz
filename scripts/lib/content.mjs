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
  return {
    title: title.replace(/\s*[:|]\s*Rangkuman dan Kuis( Kahoot)?$/i, ''),
    id: course.id || '',
    short: course.short || '',
    longTitle: course.title || '',
    description: lede ? stripTags(lede) : '',
    sections,
    questions: course.questions,
  };
}

export const stripTags = (s) => String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/** Slug materi dari nama file: "stat-04-diagram-pohon.html" → "stat-04-diagram-pohon" */
export const materialSlug = (file) => basename(file, '.html').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
