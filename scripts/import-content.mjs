#!/usr/bin/env node
/**
 * Impor konten repo (content/) ke Supabase: mata kuliah, materi (HTML lengkap + pratinjau
 * publik ke bucket privat "materials"), bank soal dari window.COURSE, dan satu kuis mandiri
 * per materi.
 *
 *   npm run content:import                  impor/perbarui; materi & kuis baru berstatus draf
 *   npm run content:import -- --publish     sekaligus publikasikan mata kuliah, materi, dan kuis
 *   npm run content:import -- --only stat-04-diagram-pohon   hanya materi tertentu (bisa diulang)
 *   npm run content:import -- --dry-run     tampilkan rencana tanpa menulis apa pun
 *
 * Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY (dari environment atau .env.local).
 * Aman diulang: materi dicocokkan lewat (mata kuliah, slug), soal lewat source_ref
 * "<slug-materi>#<nomor>", kuis lewat id deterministik dari slug materi. Kuis yang sudah ada
 * tidak diubah (pengaturan buatan admin tetap), kecuali dengan --update-quizzes.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { ROOT, read, loadCourses, listMaterialFiles, parseMaterial, materialSlug, CSS_RE } from './lib/content.mjs';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const only = args.flatMap((a, i) => (a === '--only' && args[i + 1] ? [args[i + 1]] : []));
const PUBLISH = flag('--publish');
const DRY = flag('--dry-run');
const UPDATE_QUIZZES = flag('--update-quizzes');
const BUCKET = 'materials';

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

/** UUID v5-gaya (SHA-1) agar id kuis stabil antar-impor */
function stableId(name) {
  const h = createHash('sha1').update('kuiskelas:' + name).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Pratinjau publik (FR-15): <head> materi (gaya tanpa skrip) + hero + bagian pertama + ajakan
 * menukar enrollment key. Semua <script> dan atribut on* dibuang; isi lengkap tidak ikut terkirim.
 */
function buildPreview(html, meta) {
  const head = (html.match(/<head>([\s\S]*?)<\/head>/) || [, ''])[1]
    .replace(/<script[\s\S]*?<\/script>/g, '');
  const hero = (html.match(/<div class="hero">[\s\S]*?<\/div>/) || [`<div class="hero"><h1>${esc(meta.title)}</h1></div>`])[0];
  const first = (html.match(/<section id="(?!bank-soal)[\w-]+"[^>]*>[\s\S]*?<\/section>/) || [''])[0];
  const toc = meta.sections.map((s) => `<li>${esc(s.label)}</li>`).join('');
  const clean = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g, '');
  return `<!DOCTYPE html>
<html lang="id">
<head>
${head.trim()}
<style>
.kk-preview-note{margin:28px 0;padding:18px 20px;border:1.5px solid var(--warn-line,#C99A1B);background:var(--warn,#FBF3D9);border-radius:8px;font-family:var(--font-head,system-ui)}
.kk-preview-note b{display:block;font-size:1rem;margin-bottom:6px}
.kk-preview-note ol{margin:10px 0 0 18px;padding:0;font-size:.88rem;line-height:1.6}
</style>
</head>
<body>
<main id="view-summary">
  <div class="wrap">
    ${clean(hero)}
    <div class="doc" style="display:block">
      <article>
${clean(first)}
        <div class="kk-preview-note">
          <b>Ini pratinjau materi.</b>
          Materi lengkap berisi ${meta.sections.length} bagian, penjelajah interaktif, dan ${meta.questions.length} soal latihan.
          Masuk lalu tukar enrollment key dari pengajar untuk membukanya.
          <ol>${toc}</ol>
        </div>
      </article>
    </div>
  </div>
</main>
</body>
</html>
`;
}

function questionRows(slug, questions) {
  return questions.map((q, i) => {
    const keys = q.o.map((_, j) => String.fromCharCode(65 + j));
    return {
      source_ref: `${slug}#${i + 1}`,
      type: 'single_choice',
      prompt: q.q,
      topic: q.topic || null,
      difficulty: q.hots ? 'hard' : 'medium',
      options: q.o.map((label, j) => ({ key: keys[j], label, display_order: j })),
      answer: { answer: keys[q.a] },
      explanation: q.e || null,
      points: q.hots ? 2 : 1,
      tags: q.hots ? ['hots'] : [],
    };
  });
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!DRY && (!url || !key)) {
    console.error('Setel NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY (mis. di .env.local).');
    process.exit(1);
  }
  const db = DRY ? null : createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

  const courses = loadCourses();
  const files = listMaterialFiles().filter((f) => !only.length || only.includes(materialSlug(f.file)));
  if (only.length && !files.length) throw new Error(`Tidak ada materi yang cocok dengan --only ${only.join(', ')}`);

  /* 1. Mata kuliah */
  const courseIds = new Map();
  for (const c of courses) {
    if (!files.some((f) => f.course === c.slug)) continue;
    const row = { slug: c.slug, title: c.title, description: c.description ?? null, display_order: c.order ?? 0, ...(PUBLISH ? { status: 'published' } : {}) };
    if (DRY) { courseIds.set(c.slug, '(dry-run)'); console.log(`mata kuliah  ${c.slug}`); continue; }
    const data = must(await db.from('courses').upsert(row, { onConflict: 'slug' }).select('id').single(), `mata kuliah ${c.slug}`);
    courseIds.set(c.slug, data.id);
  }

  const totals = { materials: 0, questions: 0, archived: 0, quizzes: 0 };
  const orderInCourse = new Map();
  for (const f of files) {
    const course = courseIds.get(f.course);
    if (!course) throw new Error(`${f.rel}: folder "${f.course}" belum terdaftar di content/courses.json`);
    const html = read(f.path);
    const meta = parseMaterial(html, f.rel);
    const slug = materialSlug(f.file);
    const order = (orderInCourse.get(f.course) ?? 0) + 1;
    orderInCourse.set(f.course, order);
    const objectives = meta.sections.filter((s) => !/^ringkasan$/i.test(s.label)).map((s) => s.label.replace(/^\d+\.\s*/, '')).join('\n');
    const qs = questionRows(slug, meta.questions);
    console.log(`materi       ${f.course}/${slug}  (${qs.length} soal)`);
    totals.materials++; totals.questions += qs.length;
    if (DRY) continue;
    if (!CSS_RE.test(html)) console.warn(`  peringatan: ${f.rel} tidak memakai mesin KuisKelas`);

    /* 2. Materi + berkas di Storage */
    const material = must(await db.from('materials').upsert({
      course_id: course, slug, title: meta.title, description: meta.description || null,
      learning_objectives: objectives || null, display_order: order, source_file: f.rel,
      ...(PUBLISH ? { status: 'published' } : {}),
    }, { onConflict: 'course_id,slug' }).select('id').single(), `materi ${slug}`);
    const id = material.id;
    const put = async (path, body) => must(await db.storage.from(BUCKET).upload(path, Buffer.from(body, 'utf8'), { upsert: true, contentType: 'text/html; charset=utf-8' }), `unggah ${path}`);
    await put(`${id}/full/index.html`, html);
    await put(`${id}/preview/index.html`, buildPreview(html, meta));
    must(await db.from('materials').update({ content_path: `${id}/full`, preview_path: `${id}/preview` }).eq('id', id), `path ${slug}`);

    /* 3. Bank soal: pakai id lama bila source_ref sudah ada (mis. dari impor CSV admin) */
    const existing = must(await db.from('questions').select('id, source_ref').like('source_ref', `${slug}#%`), `soal ${slug}`);
    const idByRef = new Map(existing.map((r) => [r.source_ref, r.id]));
    const ids = [];
    for (const q of qs) {
      const qid = idByRef.get(q.source_ref) ?? stableId('question:' + q.source_ref);
      ids.push(qid);
      must(await db.from('questions').upsert({
        id: qid, type: q.type, prompt: q.prompt, topic: q.topic, difficulty: q.difficulty, status: 'published', source_ref: q.source_ref,
      }, { onConflict: 'id' }), `soal ${q.source_ref}`);
      must(await db.from('question_options').upsert(q.options.map((o) => ({ question_id: qid, ...o, side: null })), { onConflict: 'question_id,key' }), `opsi ${q.source_ref}`);
      must(await db.from('question_options').delete().eq('question_id', qid).not('key', 'in', `(${q.options.map((o) => o.key).join(',')})`), `opsi lama ${q.source_ref}`);
      must(await db.from('question_keys').upsert({ question_id: qid, answer: q.answer, explanation: q.explanation }, { onConflict: 'question_id' }), `kunci ${q.source_ref}`);
      must(await db.from('question_materials').upsert({ question_id: qid, material_id: id }, { onConflict: 'question_id,material_id', ignoreDuplicates: true }), `tautan ${q.source_ref}`);
      if (q.tags.length) must(await db.from('question_tags').upsert(q.tags.map((tag) => ({ question_id: qid, tag })), { onConflict: 'question_id,tag', ignoreDuplicates: true }), `tag ${q.source_ref}`);
    }
    /* Soal yang sudah dihapus dari HTML diarsipkan (tidak dihapus agar riwayat jawaban tetap utuh) */
    const stale = existing.filter((r) => !ids.includes(r.id)).map((r) => r.id);
    if (stale.length) {
      must(await db.from('questions').update({ status: 'archived' }).in('id', stale), `arsip ${slug}`);
      totals.archived += stale.length;
    }

    /* 4. Satu kuis mandiri per materi, terbuka untuk tamu */
    const quizId = stableId('quiz:' + slug);
    const quiz = must(await db.from('quizzes').select('id').eq('id', quizId).maybeSingle(), `kuis ${slug}`);
    if (!quiz || UPDATE_QUIZZES) {
      must(await db.from('quizzes').upsert({
        id: quizId,
        title: `Kuis: ${meta.short || meta.title}`,
        description: `Latihan mandiri ${qs.length} soal untuk materi "${meta.title}".`,
        mode: 'self_paced',
        settings: { shuffle_questions: true, shuffle_options: true, question_time_sec: 30, show_feedback: 'after_submit', allow_guests: true, pass_threshold: 60, show_leaderboard: true },
        ...(PUBLISH ? { status: 'published' } : quiz ? {} : { status: 'draft' }),
      }, { onConflict: 'id' }), `kuis ${slug}`);
      must(await db.from('quiz_questions').delete().eq('quiz_id', quizId), `soal kuis ${slug}`);
      must(await db.from('quiz_questions').insert(qs.map((q, i) => ({ quiz_id: quizId, question_id: ids[i], display_order: i, points: q.points }))), `soal kuis ${slug}`);
      totals.quizzes++;
    } else if (PUBLISH) {
      must(await db.from('quizzes').update({ status: 'published' }).eq('id', quizId).neq('status', 'archived'), `publikasi kuis ${slug}`);
    }
  }

  console.log(`\nSelesai${DRY ? ' (dry-run)' : ''}: ${totals.materials} materi, ${totals.questions} soal` +
    `${totals.archived ? `, ${totals.archived} soal lama diarsipkan` : ''}, ${totals.quizzes} kuis dibuat/diperbarui` +
    `${PUBLISH ? ', semua dipublikasikan' : '. Jalankan dengan --publish untuk mempublikasikan'}.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
