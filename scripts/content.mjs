#!/usr/bin/env node
/**
 * Pemeliharaan konten materi.
 *
 *   npm run content:sync    salin content/engine/kuiskelas.{js,css} ke semua materi
 *   npm run content:check   pastikan semua materi memakai mesin terbaru dan data soalnya valid
 *
 * Hanya blok mesin yang disentuh; isi materi, soal, dan skrip khusus materi tidak diubah.
 */
import { writeFileSync } from 'node:fs';
import { listMaterialFiles, loadCourses, parseMaterial, read, withEngine } from './lib/content.mjs';

function sync() {
  let changed = 0;
  for (const m of listMaterialFiles()) {
    const old = read(m.path);
    const next = withEngine(old);
    if (next === null) { console.log(`  lewati (tanpa mesin KuisKelas): ${m.rel}`); continue; }
    if (next !== old) { writeFileSync(m.path, next); changed++; console.log(`  diperbarui: ${m.rel}`); }
  }
  console.log(`sync: ${changed} file diperbarui`);
}

function validateQuestions(q, rel) {
  const bad = [];
  q.forEach((x, i) => {
    const n = `${rel} soal ${i + 1}`;
    if (!x.q) bad.push(`${n}: teks soal kosong`);
    if (!Array.isArray(x.o) || x.o.length !== 4) bad.push(`${n}: opsi harus tepat 4`);
    if (!Number.isInteger(x.a) || x.a < 0 || x.a > 3) bad.push(`${n}: kunci harus 0–3`);
  });
  return bad;
}

function check() {
  const bad = [];
  const courses = new Set(loadCourses().map((c) => c.slug));
  const ids = new Map();
  let total = 0;
  for (const m of listMaterialFiles()) {
    if (!courses.has(m.course)) bad.push(`${m.rel}: folder "${m.course}" belum terdaftar di content/courses.json`);
    const html = read(m.path);
    const next = withEngine(html);
    if (next === null) bad.push(`${m.rel}: tidak memakai mesin KuisKelas`);
    else if (next !== html) bad.push(`${m.rel}: mesin usang (jalankan npm run content:sync)`);
    try {
      const p = parseMaterial(html, m.rel);
      bad.push(...validateQuestions(p.questions, m.rel));
      total += p.questions.length;
      if (p.id && ids.has(p.id)) bad.push(`${m.rel}: COURSE.id "${p.id}" sama dengan ${ids.get(p.id)}`);
      ids.set(p.id, m.rel);
    } catch (e) { bad.push(e.message); }
  }
  bad.forEach((b) => console.log('  ' + b));
  console.log(bad.length ? `check: ${bad.length} masalah` : `check: ${ids.size} materi, ${total} soal, semua mutakhir`);
  process.exitCode = bad.length ? 1 : 0;
}

const cmd = process.argv[2];
if (cmd === 'sync') sync();
else if (cmd === 'check') check();
else { console.log('Pemakaian: node scripts/content.mjs <sync|check>'); process.exitCode = 2; }
