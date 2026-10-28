/*!
 * KuisKelas Online v2.0.0
 * Hub mode online untuk semua materi: room kelas dengan PIN, layar pengajar, peserta, peringkat XP
 * kelas, dan rekap nilai (Supabase). File materi tidak diubah: soal dibaca langsung dari file HTML
 * materi (daftar di materi.json), lalu disimpan ke room sehingga peserta cukup memasukkan PIN.
 * Profil, XP, dan lencana memakai penyimpanan yang sama dengan mesin offline (localStorage "kq:").
 * Konfigurasi: online/config.js (window.KQ_ONLINE). Skema server: online/schema.sql.
 */
(function () {
'use strict';

/* =====================================================================
   0. Konfigurasi
   ===================================================================== */
const VERSION = '2.0.0';
const CFG = Object.assign({
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseJs: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js',
  manifest: 'materi.json',
  defaultClass: ''
}, window.KQ_ONLINE || {});
/* ONLINE = kredensial terisi. netOK() = kredensial terisi DAN perangkat sedang tersambung internet. */
const ONLINE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && !/your-project|xxxx|GANTI/i.test(CFG.supabaseUrl + CFG.supabaseAnonKey));
const netOK = () => ONLINE && navigator.onLine !== false;
const CLASS_RE = /^[A-Z0-9-]{2,16}$/;
const HUB = 'KuisKelas Online';

/* =====================================================================
   1. Utilitas
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* Teks soal/opsi/pembahasan: di-escape, lalu tag format sederhana dikembalikan. */
const rich = s => esc(s)
  .replace(/&lt;(\/?)(b|i|em|strong|sub|sup|code|u|small)&gt;/g, '<$1$2>')
  .replace(/&lt;br\s*\/?&gt;/g, '<br>');
const plain = s => String(s == null ? '' : s).replace(/<[^>]*>/g, '');
const idn = (n, d = 0) => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: d });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shuffle4 = () => { const p = [0, 1, 2, 3]; for (let k = 3; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [p[k], p[j]] = [p[j], p[k]]; } return p; };
/* Parser waktu Postgres yang aman untuk Safari (pecahan detik dipangkas ke milidetik) */
const parseTs = t => Date.parse(String(t).replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1').replace(/([+-]\d{2})$/, '$1:00'));
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmtPin = p => String(p).replace(/(\d{3})(\d{3})/, '$1 $2');
/* Path materi (boleh berisi spasi dan "&") → URL relatif yang aman */
const materiUrl = path => path ? path.split('/').map(encodeURIComponent).join('/') : '';
/* Id materi = cara mesin offline menghitung MID, agar kunci XP sama */
const midOf = (id, title) => String(id || title || 'materi').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'materi';

const LS = {
  get(k, d) { try { const v = localStorage.getItem('kq:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('kq:' + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem('kq:' + k); } catch (e) { } }
};

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat ' + src + ' (network)'));
    document.head.appendChild(s);
  });
}

const SHAPES = [
  '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 30 28H2z"/></svg>',
  '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 30 16 16 30 2 16z"/></svg>',
  '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13"/></svg>',
  '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="24" height="24"/></svg>'
];
const SHAPE_NAME = ['Segitiga merah', 'Belah ketupat biru', 'Lingkaran kuning', 'Persegi hijau'];
const SHAPE_COLOR = ['#E21B3C', '#1368CE', '#D89E00', '#26890C'];
const MOODS = { '': '#46178F', correct: '#26890C', wrong: '#C4162F', timeout: '#1368CE', board: '#2B0B5C' };
const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐙', '🦉', '🐧', '🦄', '🐝', '🐳', '🦖', '🐱', '🤖', '👾', '🚀', '🌵'];

/* Pesan galat dari server → kalimat yang bisa ditindaklanjuti */
const ERR = {
  ROOM_NOT_FOUND: 'PIN tidak ditemukan. Periksa lagi 6 angka di layar pengajar.',
  ROOM_CLOSED: 'Room ini sudah selesai. Minta PIN baru ke pengajar.',
  ROOM_FULL: 'Room sudah penuh (maksimal 200 peserta).',
  NOT_ACCEPTING: 'Waktu menjawab soal ini sudah ditutup.',
  TIME_UP: 'Jawaban sampai setelah waktu habis.',
  ALREADY_ANSWERED: 'Jawaban untuk soal ini sudah terkirim.',
  NOT_JOINED: 'Kamu belum masuk room ini. Gabung ulang dengan PIN.',
  NOT_HOST: 'Hanya perangkat pembuat room yang bisa mengatur permainan.',
  RATE_LIMIT: 'Terlalu banyak room dibuat dalam satu jam. Coba lagi nanti.',
  BAD_CLASS: 'Kode kelas hanya boleh huruf kapital, angka, dan tanda minus (2–16 karakter).',
  BAD_QUIZ: 'Data soal di file materi tidak valid.',
  AUTH_REQUIRED: 'Belum tersambung ke server. Muat ulang halaman lalu coba lagi.',
  OFFLINE: 'Mode online belum aktif: isi supabaseUrl dan supabaseAnonKey di online/config.js.',
  NO_NET: 'Perangkat ini sedang tanpa internet. Mode online butuh koneksi; materi tetap bisa dibuka untuk latihan solo.',
  NO_COURSE: 'File ini tidak berisi data soal KuisKelas (window.COURSE).',
  PARSE_TIMEOUT: 'Membaca soal dari file materi terlalu lama. Periksa file materinya.'
};
function errMsg(e) {
  const m = String((e && (e.message || e.error_description || e.msg)) || e || '');
  for (const k in ERR) if (m.includes(k)) return ERR[k];
  if (/anonymous/i.test(m)) return 'Login anonim belum aktif di Supabase (Authentication > Sign In / Providers > Anonymous sign-ins).';
  if (/rate limit/i.test(m)) return 'Server menolak karena batas login anonim tercapai. Naikkan batasnya di Supabase (Authentication > Rate Limits).';
  if (/does not exist|schema cache/i.test(m)) return 'Tabel atau fungsi belum ada. Jalankan online/schema.sql di Supabase SQL Editor.';
  if (/fetch|network|Failed/i.test(m)) return 'Tidak ada koneksi ke server. Periksa internet lalu coba lagi.';
  return 'Terjadi galat: ' + m;
}

/* =====================================================================
   2. Suara (Web Audio, tanpa file eksternal)
   ===================================================================== */
let actx = null, soundOn = LS.get('sound', true);
function tone(freq, dur = .12, type = 'sine', vol = .07, delay = 0) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + .02);
  } catch (e) { }
}
const sfx = {
  tick: () => tone(880, .05, 'square', .03),
  start: () => { tone(523, .12, 'triangle', .08, 0); tone(659, .12, 'triangle', .08, .12); tone(784, .2, 'triangle', .08, .24); },
  ok: () => { tone(660, .12, 'sine', .09, 0); tone(880, .22, 'sine', .09, .12); },
  no: () => tone(150, .4, 'sawtooth', .05),
  late: () => tone(300, .3, 'triangle', .06),
  join: () => tone(990, .08, 'sine', .05),
  xp: () => { tone(1046, .08, 'sine', .05, 0); tone(1318, .12, 'sine', .05, .07); },
  level: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .2, 'triangle', .08, i * .1)); },
  end: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', .08, i * .14)); }
};

/* =====================================================================
   3. Profil, XP, level, lencana (sama dengan mesin offline)
   ===================================================================== */
const P0 = { nickname: '', studentId: '', classCode: CFG.defaultClass ? String(CFG.defaultClass).toUpperCase() : '', avatar: AVATARS[0], xp: 0, badges: [], awarded: {}, games: 0, bestScore: 0, dayStreak: 0, lastDay: '', read: {}, labs: {} };
let P = loadProfile();
function loadProfile() {
  const p = Object.assign({}, P0, LS.get('profile', {}));
  p.read = p.read || {}; p.labs = p.labs || {}; p.awarded = p.awarded || {}; p.badges = p.badges || [];
  return p;
}
/* P disegarkan dari penyimpanan saat tab materi lain mengubahnya (event storage di bagian 13) */
const saveP = () => { LS.set('profile', P); refreshChip(); queueSync(); };

const need = n => 50 * (n - 1) * n;                 // XP minimum untuk level n: 0, 100, 300, 600, 1000, 1500 ...
const levelOf = x => { let n = 1; while (x >= need(n + 1)) n++; return n; };
const LV_NAMES = ['Pemula', 'Penjelajah', 'Analis', 'Praktisi', 'Ahli', 'Pakar', 'Master', 'Legenda'];
const lvName = n => LV_NAMES[Math.min(n, LV_NAMES.length) - 1];
const lvProgress = x => { const n = levelOf(x), a = need(n), b = need(n + 1); return { n, pct: Math.round((x - a) / (b - a) * 100), toNext: b - x }; };

const BADGES = [
  ['first', '🎯', 'Langkah pertama', 'Selesaikan satu kuis'],
  ['streak5', '🔥', 'Beruntun 5', '5 jawaban benar berturut-turut'],
  ['streak10', '☄️', 'Tak terbendung', '10 benar berturut-turut'],
  ['perfect', '💎', 'Sempurna', 'Semua soal benar dalam satu permainan'],
  ['hots', '🧠', 'Pemikir tajam', 'Semua soal HOTS benar dalam satu permainan'],
  ['speed', '⚡', 'Kilat', 'Rata-rata di bawah 5 detik, akurasi minimal 70%'],
  ['comeback', '🚀', 'Bangkit', 'Dari luar lima besar menjadi juara 1'],
  ['reader', '📖', 'Pembaca tuntas', 'Tandai semua bab dalam satu materi'],
  ['labrat', '🧪', 'Tangan laboratorium', 'Coba semua lab dalam satu materi'],
  ['online', '📡', 'Main bareng', 'Ikuti satu room online sampai selesai (KuisKelas Online)'],
  ['podium', '🥉', 'Naik podium', 'Masuk tiga besar di room online (KuisKelas Online)'],
  ['champ', '👑', 'Juara kelas', 'Peringkat 1 di room online (KuisKelas Online)'],
  ['host', '🎤', 'Pemandu', 'Pandu satu room online sampai selesai (KuisKelas Online)'],
  ['day3', '📅', 'Rajin', 'Belajar 3 hari berturut-turut'],
  ['day7', '🗓️', 'Seminggu penuh', 'Belajar 7 hari berturut-turut'],
  ['lv5', '🏅', 'Ahli', 'Capai level 5']
];
const BADGE = Object.fromEntries(BADGES.map(b => [b[0], b]));

function addXp(amount, label) {
  amount = Math.max(0, Math.round(amount)); if (!amount) return 0;
  const before = levelOf(P.xp);
  P.xp += amount;
  const after = levelOf(P.xp);
  saveP();
  if (label) toast('+' + idn(amount) + ' XP', label, 'xp', '⭐');
  if (after > before) setTimeout(() => levelUp(after), 500);
  if (after >= 5) giveBadge('lv5');
  return amount;
}
function award(key, amount, label) {
  if (key) { if (P.awarded[key]) return 0; P.awarded[key] = 1; }
  return addXp(amount, label);
}
function giveBadge(id) {
  if (!BADGE[id] || P.badges.includes(id)) return false;
  P.badges.push(id); saveP();
  const b = BADGE[id];
  setTimeout(() => { toast('Lencana baru: ' + b[2], b[3], 'lv', b[1]); sfx.xp(); }, 300);
  return true;
}
function profileReady(kind) {
  if (!P.nickname) return false;
  if (kind === 'online') return !!(P.studentId && CLASS_RE.test(P.classCode || ''));
  return true;
}

/* =====================================================================
   4. Umpan balik visual: toast, level up, confetti
   ===================================================================== */
function toast(title, sub, kind = '', icon = '') {
  const box = $('#kqToasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'kq-toast ' + kind; el.setAttribute('role', 'status');
  el.innerHTML = (icon ? `<span class="ic" aria-hidden="true">${icon}</span>` : '') + `<div>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3200);
}
function levelUp(n) {
  sfx.level(); confetti();
  const o = document.createElement('div');
  o.className = 'lvup'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Naik level');
  o.innerHTML = `<div><p>Naik level!</p><span class="big">Lv ${n}</span><p>Gelar baru: ${esc(lvName(n))}</p><button class="kq-btn light">Lanjut</button></div>`;
  document.body.appendChild(o);
  const close = () => o.remove();
  o.querySelector('button').addEventListener('click', close);
  o.querySelector('button').focus({ preventScroll: true });
  setTimeout(close, 4500);
}
function confetti() {
  if (reduceMotion()) return;
  const wrap = document.createElement('div'); wrap.className = 'confetti'; wrap.setAttribute('aria-hidden', 'true');
  const cols = ['#E21B3C', '#1368CE', '#F5B301', '#26890C', '#ffffff', '#B99CF2'];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = cols[i % cols.length];
    p.style.animationDuration = (1.8 + Math.random() * 1.6) + 's';
    p.style.animationDelay = (Math.random() * .6) + 's';
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 4200);
}

/* =====================================================================
   5. Supabase (dimuat hanya saat mode online dipakai)
   ===================================================================== */
let sbP = null, UID = null;
function sb() {
  if (!ONLINE) return Promise.reject(new Error('OFFLINE'));
  if (navigator.onLine === false) return Promise.reject(new Error('NO_NET'));
  if (sbP) return sbP;
  sbP = (window.supabase && window.supabase.createClient ? Promise.resolve() : loadScript(CFG.supabaseJs))
    .then(async () => {
      const cli = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kq-auth' } });
      let { data: { session } } = await cli.auth.getSession();
      if (!session) {
        const r = await cli.auth.signInAnonymously();
        if (r.error) throw r.error;
        session = r.data.session;
      }
      UID = session.user.id;
      return cli;
    })
    .catch(e => { sbP = null; throw e; });
  return sbP;
}
async function rpc(fn, args) {
  const c = await sb();
  const { data, error } = await c.rpc(fn, args || {});
  if (error) throw error;
  return data;
}
async function sel(table, build, cols) {
  const c = await sb();
  let q = c.from(table).select(cols || '*');
  if (build) q = build(q);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
/* Kolom profil yang boleh dibaca semua orang (NIM tidak ikut) */
const PROFILE_COLS = 'user_id,nickname,class_code,avatar,xp,level,badges,games,best_score,day_streak,updated_at';
let syncT = null;
function queueSync() {
  if (!netOK() || !profileReady('online')) return;
  clearTimeout(syncT);
  syncT = setTimeout(async () => {
    try {
      await rpc('kq_sync_profile', {
        p_student_id: P.studentId, p_nickname: P.nickname, p_class: P.classCode, p_avatar: P.avatar,
        p_xp: P.xp, p_level: levelOf(P.xp), p_badges: P.badges, p_games: P.games, p_best_score: P.bestScore,
        p_day_streak: P.dayStreak || 0
      });
    } catch (e) { console.warn('[KuisKelas Online] sinkron profil:', e.message || e); }
  }, 1500);
}
function csvDownload(name, rows) {
  const s = rows.map(r => r.map(v => { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n');
  const blob = new Blob(['﻿' + s], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* =====================================================================
   6. Pembaca materi: materi.json + data soal dari file HTML materi
   ===================================================================== */
const Materi = {
  list: null,

  async manifest() {
    if (this.list) return this.list;
    const r = await fetch(CFG.manifest, { cache: 'no-cache' });
    if (!r.ok) throw new Error('materi.json tidak ditemukan (HTTP ' + r.status + ')');
    const m = await r.json();
    this.list = Array.isArray(m.materials) ? m.materials : [];
    return this.list;
  },

  async load(path) {
    const r = await fetch(materiUrl(path), { cache: 'no-cache' });
    if (!r.ok) throw new Error('Gagal membuka ' + path + ' (HTTP ' + r.status + ')');
    return this.parse(await r.text(), path);
  },

  /* Baca soal tanpa menjalankan materi: DOMParser tidak mengeksekusi skrip, lalu hanya blok data
     soal yang dievaluasi di iframe sandbox (origin terpisah, tanpa akses ke profil di halaman ini). */
  async parse(html, path) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = (doc.querySelector('title') || {}).textContent || path || 'Materi';
    let code = '';
    const s = [...doc.querySelectorAll('script:not([src])')].find(x => /window\.COURSE\s*=/.test(x.textContent));
    if (s) code = s.textContent;
    else {
      /* Format lama (pcd-01, pcd-02): const Q = [ ... ]; di dalam skrip aplikasi */
      const legacy = [...doc.querySelectorAll('script:not([src])')].map(x => x.textContent).find(t => /\bconst Q\s*=\s*\[/.test(t));
      const lit = legacy && sliceArray(legacy, legacy.search(/\bconst Q\s*=\s*\[/));
      if (lit) code = 'window.COURSE = { title: ' + JSON.stringify(title.replace(/\s*[:|]\s*Rangkuman.*$/, '')) + ', questions: ' + lit + ' };';
    }
    if (!code) throw new Error('NO_COURSE');
    const course = await sandboxEval(code);
    if (!course || !Array.isArray(course.questions)) throw new Error('NO_COURSE');
    const sections = {};
    doc.querySelectorAll('#view-summary section[id]').forEach(sec => {
      const h = sec.querySelector('h2');
      sections[sec.id] = plain(sec.dataset.toc || (h ? h.textContent : sec.id)).trim();
    });
    return normCourse(course, { path: path || '', sections, docTitle: title });
  }
};
/* Potong literal array "[ ... ]" mulai dari posisi tertentu, dengan memperhatikan string */
function sliceArray(src, from) {
  const a = src.indexOf('[', from); if (a < 0) return '';
  let depth = 0, q = '';
  for (let i = a; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return src.slice(a, i + 1);
  }
  return '';
}
function sandboxEval(code) {
  return new Promise((resolve, reject) => {
    const f = document.createElement('iframe');
    const tok = Math.random().toString(36).slice(2);
    f.setAttribute('sandbox', 'allow-scripts');
    f.style.display = 'none';
    const done = () => { clearTimeout(t); window.removeEventListener('message', onMsg); f.remove(); };
    const onMsg = e => {
      if (e.source !== f.contentWindow || !e.data || e.data.tok !== tok) return;
      done();
      e.data.err ? reject(new Error(e.data.err)) : resolve(e.data.course);
    };
    const t = setTimeout(() => { done(); reject(new Error('PARSE_TIMEOUT')); }, 6000);
    window.addEventListener('message', onMsg);
    const post = 'parent.postMessage';
    f.srcdoc = '<!doctype html><meta charset="utf-8"><script>window.onerror=function(m){' + post + '({tok:"' + tok + '",err:String(m)},"*")};<\/script>'
      + '<script>' + code + '<\/script>'
      + '<script>try{' + post + '({tok:"' + tok + '",course:JSON.parse(JSON.stringify(window.COURSE||null))},"*")}catch(e){' + post + '({tok:"' + tok + '",err:String(e)},"*")}<\/script>';
    document.body.appendChild(f);
  });
}
/* Samakan bentuk data soal dan periksa kesalahan pembuatan materi */
function normCourse(c, extra) {
  const Q = c.questions.map(q => Object.assign({ time: q.hots ? 40 : 20 }, q));
  const bad = [];
  if (!Q.length) bad.push('COURSE.questions kosong.');
  Q.forEach((q, i) => {
    const n = 'Soal ' + (i + 1) + ': ';
    if (!q.q) bad.push(n + 'teks soal (q) kosong');
    if (!Array.isArray(q.o) || q.o.length !== 4) bad.push(n + 'opsi (o) harus tepat 4');
    if (!(Number.isInteger(q.a) && q.a >= 0 && q.a <= 3)) bad.push(n + 'kunci (a) harus 0–3');
  });
  const title = c.title || c.short || extra.docTitle;
  return {
    Q, bad, path: extra.path, sections: extra.sections || {},
    mid: midOf(c.id, extra.docTitle), title, short: c.short || title
  };
}
/* Kunci & pembahasan yang dibuka server (kq_room_reveal) digabung ke daftar soal */
function mergeReveal(Q, r) {
  if (!r) return;
  (r.key || []).forEach((k, i) => { if (k != null && Q[i]) { Q[i].a = k; Q[i].e = (r.expl || [])[i] || ''; } });
}
/* Soal dari baris room (tanpa kunci) → daftar soal siap tampil */
function roomQuestions(room) {
  return (room.questions || []).map((q, i) => Object.assign({ time: (room.times || [])[i] || 20, hots: !!(room.hots || [])[i] }, q));
}

/* =====================================================================
   7. Kerangka halaman: header, beranda (katalog), panggung kuis, dialog
   ===================================================================== */
function buildShell() {
  const header = document.createElement('header');
  header.className = 'top';
  header.innerHTML = `
    <div class="top-in">
      <div class="brand">${HUB}</div>
      <div class="top-r">
        <div class="tabs" role="tablist" aria-label="Pilih tampilan">
          <button class="tab" role="tab" data-view="home" aria-selected="true">Materi</button>
          <button class="tab" role="tab" data-view="quiz" aria-selected="false">Room</button>
        </div>
        <button class="me-chip" id="meChip" aria-haspopup="dialog" aria-label="Profil dan pencapaian">
          <span class="me-av" id="meAv"></span>
          <span class="me-lv"><b id="meLv"></b><span class="me-bar"><i id="meBar"></i></span></span>
        </button>
      </div>
    </div>`;
  document.body.insertBefore(header, document.body.firstChild);

  const quiz = $('#view-quiz');
  quiz.innerHTML = `
    <div class="kq-stage">
      <div class="kq-bar">
        <span class="kq-pill" id="kqTitle">Room</span>
        <button class="kq-mute" id="muteBtn" aria-pressed="${!soundOn}">Suara: ${soundOn ? 'nyala' : 'mati'}</button>
      </div>
      <div id="kq-root" style="flex:1;display:flex;flex-direction:column" aria-live="polite"></div>
    </div>`;

  const t = document.createElement('div'); t.id = 'kqToasts'; t.className = 'kq-toasts'; t.setAttribute('aria-live', 'polite');
  document.body.appendChild(t);
  const d = document.createElement('dialog'); d.id = 'kqDlg'; d.className = 'kq-dlg';
  document.body.appendChild(d);

  $$('.tab').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $('#meChip').addEventListener('click', openProfile);
  $('#muteBtn').addEventListener('click', e => {
    soundOn = !soundOn; LS.set('sound', soundOn);
    e.currentTarget.textContent = 'Suara: ' + (soundOn ? 'nyala' : 'mati');
    e.currentTarget.setAttribute('aria-pressed', String(!soundOn));
  });
  refreshChip();
}
function refreshChip() {
  const av = $('#meAv'); if (!av) return;
  const lp = lvProgress(P.xp);
  av.textContent = P.avatar;
  $('#meLv').textContent = 'Lv ' + lp.n + ' ' + lvName(lp.n);
  $('#meBar').style.width = lp.pct + '%';
  $('#meChip').title = (P.nickname || 'Profil') + ': level ' + lp.n + ' (' + lvName(lp.n) + ')';
}
function showView(v) {
  $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === v)));
  const h = $('#view-home'), q = $('#view-quiz');
  h.hidden = v !== 'home';
  q.hidden = v !== 'quiz';
  if (v === 'quiz') {
    if (!$('#kq-root').children.length) Stage.home();
    document.body.style.background = MOODS[q.dataset.mood || ''];
  } else {
    document.body.style.background = '';
  }
  window.scrollTo(0, 0);
}

/* Beranda: tiga aksi utama + katalog semua materi dari materi.json */
const Home = {
  render() {
    const net = netOK();
    $('#hubActions').innerHTML = `
      <button class="hub-act c0" id="aJoin" ${net ? '' : 'disabled'}>${SHAPES[1]}<b>Gabung room</b><span>Peserta: masukkan PIN dari layar pengajar, lalu jawab dari HP.</span></button>
      <button class="hub-act c1" id="aHost" ${net ? '' : 'disabled'}>${SHAPES[2]}<b>Buat room</b><span>Pengajar: pilih materi di katalog di bawah, lalu tampilkan soal di proyektor.</span></button>
      <button class="hub-act c2" id="aRekap" ${net ? '' : 'disabled'}>${SHAPES[3]}<b>Peringkat & rekap</b><span>Peringkat XP kelas dan nilai setiap sesi yang kamu pandu, bisa diunduh CSV.</span></button>`;
    $('#hubStatus').innerHTML = ONLINE
      ? (navigator.onLine === false ? '<div class="note warn"><p>Perangkat ini sedang tanpa internet. Room online dimatikan sampai koneksi kembali; materi tetap bisa dibuka untuk latihan solo.</p></div>' : '')
      : '<div class="note warn"><p><b>Mode online belum aktif.</b> Isi <code>supabaseUrl</code> dan <code>supabaseAnonKey</code> di <code>online/config.js</code>, lalu jalankan <code>online/schema.sql</code> di Supabase. Panduannya ada di README. Katalog materi tetap bisa dipakai untuk latihan solo.</p></div>';
    on('#aJoin', () => { showView('quiz'); Join.form(); });
    on('#aHost', () => { $('#catQ').focus(); $('#catalog').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' }); });
    on('#aRekap', () => { showView('quiz'); Rekap.open(); });
    this.catalog();
  },

  async catalog() {
    const box = $('#catList');
    let list;
    try { list = await Materi.manifest(); }
    catch (e) {
      box.innerHTML = `<p class="cat-empty">${esc(e.message)}. Jalankan <code>python3 tools/kuiskelas.py manifest</code>, atau pakai tombol "Pakai file materi" untuk membuka satu file.</p>`;
      return;
    }
    const draw = () => {
      const f = ($('#catQ').value || '').toLowerCase().trim();
      const rows = list.filter(m => !f || (m.title + ' ' + m.folder + ' ' + m.file).toLowerCase().includes(f));
      const groups = [...new Set(rows.map(m => m.folder))];
      box.innerHTML = groups.map(g => `
        <section class="cat-group"><h3>${esc(g)}</h3><div class="cat-grid">${rows.filter(m => m.folder === g).map(m => `
          <article class="mcard">
            <b>${esc(m.title)}</b>
            <small>${esc(m.file)} | ${m.questions || '?'} soal</small>
            <div class="acts">
              <a href="${esc(materiUrl(m.path))}" target="_blank" rel="noopener">Buka materi</a>
              <button type="button" data-host="${esc(m.path)}" ${netOK() ? '' : 'disabled'}>Buat room</button>
            </div>
          </article>`).join('')}</div></section>`).join('') || '<p class="cat-empty">Tidak ada materi yang cocok.</p>';
      $$('[data-host]', box).forEach(b => b.addEventListener('click', () => Host.pick(b.dataset.host)));
    };
    $('#catQ').oninput = draw;
    draw();
  }
};

/* =====================================================================
   8. Dialog profil & peringkat kelas
   ===================================================================== */
function avatarPicker(cur) {
  return `<div class="avs" role="group" aria-label="Pilih avatar">${AVATARS.map(a => `<button type="button" data-av="${a}" aria-pressed="${a === cur}" aria-label="Avatar ${a}">${a}</button>`).join('')}</div>`;
}
function bindAvatarPicker(root, onPick) {
  $$('[data-av]', root).forEach(b => b.addEventListener('click', () => {
    $$('[data-av]', root).forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true'); onPick(b.dataset.av);
  }));
}
function readProfileForm(root) {
  const v = s => ($(s, root) ? $(s, root).value : '').trim();
  return { nickname: v('[name=nick]').slice(0, 24), studentId: v('[name=nim]').slice(0, 24), classCode: v('[name=cls]').toUpperCase().replace(/\s+/g, '-').slice(0, 16) };
}
function openProfile() {
  P = loadProfile();
  const d = $('#kqDlg');
  const lp = lvProgress(P.xp);
  let av = P.avatar;
  const readN = Object.values(P.read).reduce((s, o) => s + Object.keys(o).length, 0);
  d.innerHTML = `
    <form class="dlg-in" method="dialog">
      <div class="dlg-head">
        <span class="me-av" id="dlgAv">${P.avatar}</span>
        <div><h3>${esc(P.nickname || 'Profil baru')}</h3><p>Level ${lp.n}: ${esc(lvName(lp.n))}${P.classCode ? ' | Kelas ' + esc(P.classCode) : ''}</p></div>
        <button class="dlg-x" value="close" aria-label="Tutup">Tutup</button>
      </div>
      <div class="lvbox">
        <div class="row"><span>${idn(P.xp)} XP</span><span>${idn(lp.toNext)} XP lagi ke level ${lp.n + 1}</span></div>
        <div class="me-bar"><i style="width:${lp.pct}%"></i></div>
      </div>
      <div class="dstats">
        <div><b>${P.games}</b><span>Permainan</span></div>
        <div><b>${idn(P.bestScore)}</b><span>Skor terbaik</span></div>
        <div><b>${P.dayStreak || 0}</b><span>Hari beruntun</span></div>
        <div><b>${readN}</b><span>Bab dipahami</span></div>
      </div>
      <p class="sec-t">Lencana ${P.badges.length}/${BADGES.length}</p>
      <div class="badges">${BADGES.map(b => `<div class="bdg ${P.badges.includes(b[0]) ? '' : 'locked'}" title="${esc(b[3])}"><span class="ic">${b[1]}</span>${esc(b[2])}<small>${esc(b[3])}</small></div>`).join('')}</div>
      <p class="sec-t">Identitas</p>
      ${avatarPicker(P.avatar)}
      <div class="pform">
        <label class="full">Nama panggilan<input name="nick" maxlength="24" value="${esc(P.nickname)}" autocomplete="nickname"></label>
        <label>NIM / ID siswa<input name="nim" maxlength="24" value="${esc(P.studentId)}" autocomplete="off"></label>
        <label>Kode kelas<input name="cls" maxlength="16" value="${esc(P.classCode)}" placeholder="misal TI-2A" autocomplete="off"></label>
      </div>
      <p class="err" id="dlgErr"></p>
      ${netOK() ? `<p class="sec-t">Peringkat XP kelas${P.classCode ? ' ' + esc(P.classCode) : ''}</p><div class="lbc" id="dlgLb"><span class="muted">${profileReady('online') ? 'Memuat…' : 'Isi NIM dan kode kelas untuk masuk peringkat kelas.'}</span></div>` : ''}
      <div class="dlg-act">
        <button type="button" class="btn-s danger" id="dlgReset">Hapus profil di perangkat ini</button>
        <button type="button" class="btn-s" id="dlgSave">Simpan profil</button>
      </div>
    </form>`;
  bindAvatarPicker(d, a => { av = a; $('#dlgAv').textContent = a; });
  $('#dlgSave').addEventListener('click', () => {
    const f = readProfileForm(d);
    if (!f.nickname) { $('#dlgErr').textContent = 'Isi nama panggilan terlebih dahulu.'; return; }
    if (f.classCode && !CLASS_RE.test(f.classCode)) { $('#dlgErr').textContent = ERR.BAD_CLASS; return; }
    Object.assign(P, f, { avatar: av }); saveP();
    d.close(); toast('Profil tersimpan', P.nickname + (P.classCode ? ' | ' + P.classCode : ''), '', P.avatar);
  });
  $('#dlgReset').addEventListener('click', () => {
    if (!confirm('Hapus profil, XP, dan lencana di perangkat ini? Tindakan ini tidak bisa dibatalkan.')) return;
    P = Object.assign({}, P0, { read: {}, labs: {}, awarded: {}, badges: [] }); LS.set('profile', P); refreshChip(); d.close();
    location.reload();
  });
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  if (netOK() && profileReady('online')) loadClassBoard($('#dlgLb'), P.classCode, 10);
}
async function loadClassBoard(el, cls, limit) {
  if (!el) return;
  try {
    const rows = await sel('kq_profiles', q => q.eq('class_code', cls).order('xp', { ascending: false }).limit(limit), PROFILE_COLS);
    if (!rows.length) { el.innerHTML = '<span class="muted">Belum ada anggota kelas ini di peringkat.</span>'; return; }
    el.innerHTML = rows.map((r, i) => `<div class="${r.user_id === UID ? 'me' : ''}"><b>${i + 1}</b><span>${esc(r.avatar || '🙂')}</span><span>${esc(r.nickname)}${r.user_id === UID ? ' (kamu)' : ''}<span class="muted">Lv ${levelOf(r.xp)} | ${(r.badges || []).length} lencana</span></span><b>${idn(r.xp)} XP</b></div>`).join('');
  } catch (e) { el.innerHTML = `<span class="muted">${esc(errMsg(e))}</span>`; }
}

/* =====================================================================
   9. Panggung: menu room, profil singkat, layar tunggu & galat
   ===================================================================== */
let KEYPICK = null;   // fungsi pemilih jawaban aktif (untuk tombol 1–4 / A–D)
function draw(html, mood, title) {
  KEYPICK = null;
  $('#kq-root').innerHTML = html;
  const q = $('#view-quiz');
  q.dataset.mood = mood || '';
  if (!q.hidden) document.body.style.background = MOODS[mood || ''];
  $('#kqTitle').textContent = title || HUB;
  const f = $('#kq-root [data-focus]'); if (f && !q.hidden) f.focus({ preventScroll: true });
}
const on = (sel, fn, ev = 'click') => { const el = $(sel); if (el) el.addEventListener(ev, fn); return el; };
const loading = (msg, title) => draw(`<div class="kq-center"><div class="wait-dots" aria-hidden="true"><i></i><i></i><i></i></div><p class="kq-sub">${esc(msg)}</p></div>`, '', title);
const failScreen = (e, back) => {
  draw(`<div class="kq-center"><div class="kq-verdict" style="font-size:1.8rem">Belum bisa tersambung</div><p class="kq-sub">${esc(errMsg(e))}</p><div class="btnrow"><button class="kq-btn light" id="fbBack" data-focus>Kembali</button></div></div>`, 'timeout');
  on('#fbBack', back || (() => Stage.home()));
};
function whoami() {
  const lp = lvProgress(P.xp);
  return `<button class="whoami" id="whoBtn" aria-label="Buka profil"><span class="me-av">${P.avatar}</span><span style="text-align:left">${esc(P.nickname || 'Profil baru')}<small>Lv ${lp.n} ${esc(lvName(lp.n))} | ${idn(P.xp)} XP</small><span class="me-bar"><i style="width:${lp.pct}%"></i></span></span></button>`;
}

const Stage = {
  home() {
    Host.stop(); Join.stop();
    const net = netOK();
    const hosting = LS.get('hosting', null);
    const canResume = net && hosting && hosting.online && Date.now() - hosting.t < 6 * 3600e3;
    const joined = LS.get('joined', null);
    const canRejoin = net && joined && joined.online && Date.now() - joined.t < 3 * 3600e3;
    draw(`
      <div class="kq-center">
        <div class="kq-logo">${HUB}</div>
        ${whoami()}
        <p class="kq-sub">Main bareng satu kelas: pengajar membuat room dari materi mana pun di katalog, peserta bergabung dengan PIN. XP dan lencana masuk ke profil yang sama dengan latihan solo.</p>
        <div class="modes">
          <button class="mode c1" id="mJoin" data-focus ${net ? '' : 'disabled'}>${SHAPES[1].replace('<svg', '<svg class="shape"')}<b>Gabung room</b><span>Masukkan PIN dari layar pengajar, lalu jawab dari perangkatmu.</span></button>
          <button class="mode c2" id="mHost" ${net ? '' : 'disabled'}>${SHAPES[2].replace('<svg', '<svg class="shape"')}<b>Buat room</b><span>Untuk pengajar: pilih materi dari katalog, tampilkan soal di proyektor.</span></button>
          <button class="mode c3" id="mRekap" ${net ? '' : 'disabled'}>${SHAPES[3].replace('<svg', '<svg class="shape"')}<b>Peringkat & rekap</b><span>Lihat peringkat XP kelas dan unduh nilai setiap sesi sebagai CSV.</span></button>
          <button class="mode c0" id="mCat">${SHAPES[0].replace('<svg', '<svg class="shape"')}<b>Katalog materi</b><span>Buka materi untuk dibaca atau latihan solo tanpa internet.</span></button>
        </div>
        ${canRejoin ? `<button class="kq-btn ghost" id="mRejoin">Kembali ke room ${esc(joined.pin)}</button>` : ''}
        ${canResume ? `<button class="kq-btn ghost" id="mResume">Lanjutkan memandu room ${esc(hosting.pin)}</button>` : ''}
        ${net ? '' : `<p class="offline-note">${ONLINE ? 'Perangkat ini sedang tanpa internet, jadi room online dimatikan.' : esc(ERR.OFFLINE)}</p>`}
      </div>`, '', HUB);
    on('#whoBtn', openProfile);
    on('#mJoin', () => Join.form());
    on('#mHost', () => showView('home'));
    on('#mCat', () => showView('home'));
    on('#mRekap', () => Rekap.open());
    on('#mResume', () => Host.resume(hosting.pin));
    on('#mRejoin', () => Join.join(joined.pin));
  },

  /* Formulir profil singkat. kind: 'solo' | 'online' */
  gate(kind, next) {
    let av = P.avatar;
    const online = kind === 'online';
    draw(`
      <div class="kq-center">
        <div class="kq-logo" style="font-size:clamp(1.8rem,5vw,2.6rem)">${online ? 'Lengkapi profil kelas' : 'Buat profil'}</div>
        <p class="kq-sub">${online ? 'Mode online butuh NIM dan kode kelas agar nilaimu tercatat untuk pengajar.' : 'Profil tersimpan di perangkat ini dan mengumpulkan XP, level, serta lencana dari semua materi.'}</p>
        <div class="kq-form" id="gateForm">
          ${avatarPicker(av)}
          <input type="text" name="nick" maxlength="24" placeholder="Nama panggilan" value="${esc(P.nickname)}" aria-label="Nama panggilan" autocomplete="nickname" data-focus>
          <div class="row2">
            <input type="text" name="nim" maxlength="24" placeholder="NIM${online ? '' : ' (opsional)'}" value="${esc(P.studentId)}" aria-label="NIM atau ID siswa" autocomplete="off">
            <input type="text" name="cls" maxlength="16" placeholder="Kode kelas${online ? '' : ' (opsional)'}" value="${esc(P.classCode)}" aria-label="Kode kelas" autocomplete="off">
          </div>
          <small class="help">Kode kelas diberikan pengajar, misalnya TI-2A. Huruf, angka, dan tanda minus.</small>
          <p class="err" id="gErr"></p>
          <button class="kq-btn" id="gSave">Simpan dan lanjut</button>
        </div>
      </div>`, '', 'Profil');
    const root = $('#gateForm');
    bindAvatarPicker(root, a => { av = a; });
    const save = () => {
      const f = readProfileForm(root);
      const err = $('#gErr');
      if (!f.nickname) return err.textContent = 'Isi nama panggilan terlebih dahulu.';
      if (online && !f.studentId) return err.textContent = 'Isi NIM atau ID siswa untuk mode online.';
      if ((online || f.classCode) && !CLASS_RE.test(f.classCode)) return err.textContent = ERR.BAD_CLASS;
      Object.assign(P, f, { avatar: av }); saveP();
      next();
    };
    on('#gSave', save);
    $$('input', root).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') save(); }));
  }
};

/* ----- Potongan tampilan yang dipakai host dan peserta ----- */
function distHtml(perm, key, counts, mx) {
  return `<div class="kq-dist" aria-label="Sebaran jawaban">${perm.map((orig, disp) => `
    <div class="${orig === key ? 'ok' : 'no'}"><span>${counts[orig]}</span><i style="height:${Math.max(6, counts[orig] / mx * 80)}px;background:${SHAPE_COLOR[disp]}"></i>${SHAPES[disp]}</div>`).join('')}</div>`;
}
function boardHtml(r, last, nextLabel, extra) {
  const mx = Math.max(...r.map(x => x.score), 1);
  const shown = r.slice(0, 5);
  const meIdx = r.findIndex(x => x.me);
  if (meIdx >= 5) shown.push(r[meIdx]);
  return `
    <div class="kq-center">
      <h2 class="kq-verdict" style="font-size:2rem">Papan skor</h2>
      <div class="lb">${shown.map(x => `<div class="lb-row ${x.me ? 'me' : ''}"><div class="lb-fill" data-w="${Math.max(4, x.score / mx * 100)}" style="width:${Math.max(4, (x.prev || 0) / mx * 100)}%"></div><span class="lb-rank">${r.indexOf(x) + 1}</span><span class="lb-name">${esc(x.name)}${x.me ? ' (kamu)' : ''}</span><span class="lb-score">${idn(x.score)}</span></div>`).join('') || '<p class="kq-sub">Belum ada peserta.</p>'}</div>
      ${extra || ''}
      ${nextLabel === false ? '' : `<button class="kq-btn light" id="nextQ" data-focus>${nextLabel || (last ? 'Lihat hasil akhir' : 'Soal berikutnya')}</button>`}
    </div>`;
}
function animateBoard() {
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.lb-fill').forEach(el => el.style.width = el.dataset.w + '%')));
}
function podiumHtml(r) {
  const top = [r[1], r[0], r[2]], cls = ['p2', 'p1', 'p3'], pos = [2, 1, 3];
  return `<div class="podium">${top.map((x, k) => x ? `<div class="pod ${cls[k]}"><span class="nm">${esc(x.name)}${x.me ? ' (kamu)' : ''}</span><span>${idn(x.score)}</span><div class="bl">${pos[k]}</div></div>` : '<div class="pod"></div>').join('')}</div>`;
}
function xpBoxHtml(rows, lvBefore) {
  const lp = lvProgress(P.xp), tot = rows.reduce((s, x) => s + x[1], 0);
  return `<div class="xpbox" aria-label="XP yang didapat">
    ${rows.map(x => `<div class="row"><span>${esc(x[0])}</span><span>+${idn(x[1])} XP</span></div>`).join('')}
    <div class="row tot"><span>Total</span><span>+${idn(tot)} XP</span></div>
    <div class="me-bar"><i data-w="${lp.pct}" style="width:${lp.n > lvBefore ? 0 : Math.max(0, lp.pct - Math.round(tot / Math.max(1, need(lp.n + 1) - need(lp.n)) * 100))}%"></i></div>
    <span class="lvl">Level ${lp.n} ${esc(lvName(lp.n))}${lp.n > lvBefore ? ' (naik level!)' : ''} | ${idn(lp.toNext)} XP lagi ke level ${lp.n + 1}</span>
  </div>`;
}
function animateXpBox() {
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.xpbox .me-bar i').forEach(el => el.style.width = el.dataset.w + '%')));
}
/* Penguasaan per bab; bab lemah diberi tautan ke bagian itu di file materi */
function masteryHtml(log, Q, sections, path) {
  const by = new Map();
  log.forEach(l => {
    const q = Q[l.i];
    const label = q.ref && sections[q.ref];
    const k = label ? 'ref:' + q.ref : 'topic:' + (q.topic || 'Umum');
    const o = by.get(k) || { n: 0, ok: 0, ref: label ? q.ref : '', label: label || q.topic || 'Umum' };
    o.n++; if (l.ok) o.ok++;
    by.set(k, o);
  });
  if (by.size < 2) return '';
  const rows = [...by.values()].sort((a, b) => a.ok / a.n - b.ok / b.n);
  return `<div class="mastery" aria-label="Penguasaan per bab"><b style="text-align:center">Penguasaan per bab</b>${rows.map(o => {
    const pc = Math.round(o.ok / o.n * 100), weak = pc < 60;
    return `<div class="m ${weak ? 'weak' : ''}"><span>${esc(o.label)} <small style="opacity:.75">(${o.ok}/${o.n})</small>${weak && o.ref && path ? `<a href="${esc(materiUrl(path))}#${esc(o.ref)}" target="_blank" rel="noopener">Baca lagi bab ini</a>` : ''}</span><i><b style="width:${pc}%"></b></i><span>${pc}%</span></div>`;
  }).join('')}</div>`;
}
function reviewHtml(log, Q) {
  return `<div class="review">${log.map(l => {
    const q = Q[l.i];
    const has = Number.isInteger(q.a);
    const t = l.timeout ? '<span class="tag t">Waktu habis</span>' : (l.ok ? '<span class="tag">Benar</span>' : '<span class="tag x">Salah</span>');
    return `<details><summary>${t}${q.hots ? '<span class="tag" style="background:#F5B301;color:#3a2a00">HOTS</span>' : ''}Soal ${l.i + 1}: ${rich(q.q)}</summary><p>${has ? `<b>Kunci: ${rich(q.o[q.a])}.</b>` : ''}${l.ok || l.timeout || l.picked < 0 || l.picked == null ? '' : ' Jawabanmu: ' + rich(q.o[l.picked]) + '.'} ${rich(q.e || '')}</p></details>`;
  }).join('')}</div>`;
}

/* =====================================================================
   10. Mode online: pengajar (host)
   ===================================================================== */
async function removeCh(ch) { if (!ch) return; try { const c = await sb(); c.removeChannel(ch); } catch (e) { } }
/* NIM peserta disimpan terpisah (room_roster) dan hanya bisa dibaca pemandu room */
async function withNim(pin, players) {
  let nim = {};
  try { (await sel('kq_room_roster', q => q.eq('room_pin', pin))).forEach(r => { nim[r.user_id] = r.student_id; }); } catch (e) { }
  return players.map(p => Object.assign({}, p, { student_id: nim[p.user_id] || '' }));
}

const Host = {
  pin: null, perm: null, cls: '', qi: -1, players: [], answered: new Set(), lastPts: {}, phase: 'idle',
  ch: null, poll: null, timer: null, introT: null, T: 20, t0: 0, closing: false, lastCount: 0, course: null,

  stop() {
    this.phase = 'idle';
    clearInterval(this.poll); clearInterval(this.timer); clearTimeout(this.introT);
    removeCh(this.ch); this.ch = null;
  },
  adv(status, q) { return rpc('kq_host_advance', { p_pin: this.pin, p_status: status, p_q: q }); },
  get Q() { return this.course ? this.course.Q : []; },

  /* Dari katalog: baca soal dari file materi, lalu ke layar pengaturan room */
  async pick(path) {
    showView('quiz');
    if (!netOK()) return failScreen(new Error(ONLINE ? 'NO_NET' : 'OFFLINE'), () => showView('home'));
    loading('Membaca soal dari materi…', 'Buat room');
    try { this.setup(await Materi.load(path)); }
    catch (e) { failScreen(e, () => showView('home')); }
  },
  async pickFile(file) {
    showView('quiz');
    loading('Membaca soal dari ' + file.name + '…', 'Buat room');
    try { this.setup(await Materi.parse(await file.text(), '')); }
    catch (e) { failScreen(e, () => showView('home')); }
  },

  setup(course) {
    this.stop();
    if (course.bad.length) {
      draw(`<div class="kq-center"><div class="kq-verdict" style="font-size:1.8rem">Data soal perlu diperiksa</div><p class="kq-sub">${esc(course.bad.slice(0, 6).join('; '))}${course.bad.length > 6 ? ' …' : ''}</p><button class="kq-btn light" id="hBack" data-focus>Kembali ke katalog</button></div>`, 'timeout', 'Buat room');
      return on('#hBack', () => showView('home'));
    }
    this.course = course;
    const shuffle = LS.get('shuffle', true);
    const nH = course.Q.filter(x => x.hots).length;
    draw(`
      <div class="kq-center">
        <div class="kq-logo" style="font-size:clamp(1.8rem,5vw,2.8rem)">Buat room kelas</div>
        <p class="kq-sub"><b>${esc(course.title)}</b><br>${course.Q.length} soal: ${course.Q.length - nH} reguler${nH ? ` dan ${nH} HOTS` : ''}. Tampilkan layar ini di proyektor; peserta membuka ${HUB} di HP lalu memasukkan PIN.</p>
        <div class="kq-form">
          <input type="text" id="hCls" maxlength="16" placeholder="Kode kelas, misal TI-2A" value="${esc(P.classCode || CFG.defaultClass || '')}" aria-label="Kode kelas" data-focus>
          <label class="opt"><input type="checkbox" id="hShuffle" ${shuffle ? 'checked' : ''}> Acak posisi jawaban (sama untuk semua peserta)</label>
          <p class="err" id="hErr"></p>
          <button class="kq-btn" id="hCreate">Buat room</button>
          <button class="kq-btn ghost" id="hBack" style="color:#46178F;background:#eee8fa">Kembali</button>
        </div>
      </div>`, '', 'Buat room');
    on('#hBack', () => showView('home'));
    const go = () => {
      const cls = $('#hCls').value.trim().toUpperCase().replace(/\s+/g, '-');
      if (!CLASS_RE.test(cls)) return $('#hErr').textContent = ERR.BAD_CLASS;
      LS.set('shuffle', $('#hShuffle').checked);
      this.create(cls, $('#hShuffle').checked);
    };
    on('#hCreate', go);
    on('#hCls', e => { if (e.key === 'Enter') go(); }, 'keydown');
  },

  async create(cls, sh) {
    loading('Membuat room…', 'Buat room');
    const Q = this.Q, c = this.course;
    try {
      const perm = Q.map(() => sh ? shuffle4() : [0, 1, 2, 3]);
      /* Soal disimpan tanpa kunci; kunci & pembahasan di tabel terpisah yang tidak bisa dibaca peserta */
      const pin = await rpc('kq_create_room', {
        p_class: cls, p_material: c.mid, p_path: c.path || null, p_title: c.title,
        p_questions: Q.map(q => ({ q: q.q, o: q.o, topic: q.topic || '', ref: q.ref || '' })),
        p_key: Q.map(q => q.a), p_expl: Q.map(q => q.e || ''),
        p_times: Q.map(q => q.time), p_hots: Q.map(q => !!q.hots), p_perm: perm, p_sections: c.sections || {}
      });
      Object.assign(this, { pin: String(pin), perm, cls, qi: -1, players: [], lastPts: {}, lastCount: 0 });
      LS.set('hosting', { pin: this.pin, online: true, t: Date.now() });
      await this.connect();
      this.lobby();
    } catch (e) { failScreen(e, () => this.setup(c)); }
  },

  /* Menyambung ulang tidak butuh file materi: soal dan kunci diambil dari server */
  async resume(pin) {
    loading('Menyambung ulang ke room ' + fmtPin(pin) + '…', 'Room ' + pin);
    try {
      await sb();
      const [room] = await sel('kq_rooms', q => q.eq('pin', pin));
      if (!room) throw new Error('ROOM_NOT_FOUND');
      if (room.host_uid !== UID) throw new Error('NOT_HOST');
      const Q = roomQuestions(room);
      mergeReveal(Q, await rpc('kq_room_reveal', { p_pin: pin }));
      this.course = { Q, bad: [], path: room.material_path || '', sections: room.sections || {}, mid: room.material_id, title: room.title, short: room.title };
      Object.assign(this, { pin, perm: room.perm || Q.map(() => [0, 1, 2, 3]), cls: room.class_code, qi: Math.max(0, room.q_index), lastPts: {}, lastCount: 0 });
      await this.connect();
      if (room.status === 'lobby') return this.lobby();
      if (room.status === 'intro' || room.status === 'question') return this.intro();
      if (room.status === 'result' || room.status === 'board') return this.board();
      if (room.status === 'final') return this.final();
      LS.del('hosting'); Stage.home();
    } catch (e) { LS.del('hosting'); failScreen(e); }
  },

  async connect() {
    const c = await sb();
    removeCh(this.ch);
    this.ch = c.channel('kqh-' + this.pin + '-' + Math.random().toString(36).slice(2, 7))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kq_room_players', filter: 'room_pin=eq.' + this.pin }, () => this.refreshPlayers())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kq_answers', filter: 'room_pin=eq.' + this.pin }, p => this.onAnswer(p.new))
      .subscribe();
    clearInterval(this.poll);
    this.poll = setInterval(() => this.pollTick(), 2500);   // cadangan bila realtime tidak aktif
    await this.refreshPlayers();
  },
  async refreshPlayers() {
    try { this.players = await sel('kq_room_players', q => q.eq('room_pin', this.pin).order('score', { ascending: false })); } catch (e) { return; }
    if (this.phase === 'lobby') this.paintTiles();
    if (this.phase === 'question') { this.paintCounter(); this.checkAll(); }
  },
  async pollTick() {
    await this.refreshPlayers();
    if (this.phase !== 'question') return;
    try {
      const rows = await sel('kq_answers', q => q.eq('room_pin', this.pin).eq('q_index', this.qi));
      rows.forEach(r => this.answered.add(r.user_id));
      this.paintCounter(); this.checkAll();
    } catch (e) { }
  },
  onAnswer(a) {
    if (!a || a.q_index !== this.qi) return;
    this.answered.add(a.user_id); this.paintCounter(); this.checkAll();
  },
  checkAll() {
    if (this.phase === 'question' && this.players.length && this.answered.size >= this.players.length && !this.closing) {
      this.closing = true; setTimeout(() => this.close(), 700);
    }
  },
  title() { return `Room ${fmtPin(this.pin)} | Soal ${this.qi + 1}/${this.Q.length}`; },

  lobby() {
    this.phase = 'lobby';
    const link = location.href.split('#')[0] + '#join=' + this.pin;
    const local = location.protocol === 'file:';
    draw(`
      <div class="kq-center">
        <p class="kq-sub" style="margin:0">Buka <b>${HUB}</b> di HP, pilih <b>Gabung room</b>, lalu masukkan PIN:</p>
        <div class="kq-bigpin"><small>Game PIN</small><b>${fmtPin(this.pin)}</b></div>
        ${local ? `<p class="offline-note">Halaman ini dibuka dari komputer (file://). Agar peserta bisa membukanya, unggah repo ke hosting seperti GitHub Pages lalu bagikan tautannya.</p>`
                : `<div class="joinlink"><span>Tautan langsung:</span><code>${esc(link)}</code><button class="kq-btn ghost" id="copyL">Salin tautan</button></div>`}
        <div class="kq-counter"><div><b id="pc">0</b><span>peserta</span></div><div><b>${this.Q.length}</b><span>soal</span></div><div><b>${esc(this.cls)}</b><span>kelas</span></div></div>
        <div class="tiles" id="tiles"></div>
        <div class="btnrow">
          <button class="kq-btn light" id="hStart" data-focus disabled>Mulai permainan</button>
          <button class="kq-btn ghost" id="hCancel">Tutup room</button>
        </div>
      </div>`, '', 'Room ' + fmtPin(this.pin));
    on('#copyL', e => { try { navigator.clipboard.writeText(link); e.currentTarget.textContent = 'Tautan tersalin'; } catch (x) { } });
    on('#hStart', () => { sfx.start(); this.qi = 0; this.intro(); });
    on('#hCancel', async () => {
      if (!confirm('Tutup room ini? Peserta akan dikeluarkan.')) return;
      try { await this.adv('closed', -1); } catch (e) { }
      LS.del('hosting'); Stage.home();
    });
    this.paintTiles();
  },
  paintTiles() {
    const t = $('#tiles'); if (!t) return;
    const n = this.players.length;
    t.innerHTML = this.players.map(p => `<span class="tile"><span class="me-av">${esc(p.avatar || '🙂')}</span>${esc(p.nickname)}</span>`).join('') || '<p class="kq-sub">Menunggu peserta bergabung…</p>';
    $('#pc').textContent = n;
    $('#hStart').disabled = n < 1;
    if (n > this.lastCount) sfx.join();
    this.lastCount = n;
  },

  async intro() {
    this.phase = 'intro';
    const q = this.Q[this.qi];
    try { await this.adv('intro', this.qi); } catch (e) { return failScreen(e, () => this.intro()); }
    draw(`
      <div class="kq-center">
        <div class="kq-count">Soal ${this.qi + 1} dari ${this.Q.length}</div>
        ${q.hots ? '<div class="kq-hots">Soal HOTS: poin ganda</div>' : ''}
        <h2 class="kq-bigq">${rich(q.q)}</h2>
        <div class="kq-sub">Waktu menjawab: ${q.time} detik</div>
        <div class="kq-introbar" aria-hidden="true"><i style="animation-duration:4s"></i></div>
        <button class="kq-btn ghost" id="skipIntro" data-focus>Tampilkan pilihan sekarang</button>
      </div>`, '', this.title());
    on('#skipIntro', () => this.question());
    this.introT = setTimeout(() => this.question(), 4000);
  },

  async question() {
    clearTimeout(this.introT);
    if (this.phase !== 'intro') return;
    this.phase = 'opening';
    const q = this.Q[this.qi], p = this.perm[this.qi] || [0, 1, 2, 3];
    try { await this.adv('question', this.qi); } catch (e) { this.phase = 'intro'; return failScreen(e, () => this.intro()); }
    this.phase = 'question'; this.answered = new Set(); this.closing = false; this.T = q.time; this.lastSec = q.time;
    draw(`
      <div class="kq-qbox">${rich(q.q)}</div>
      <div class="kq-timer"><div class="tnum" id="tnum">${this.T}</div><div class="tbar"><i id="tbar"></i></div></div>
      <div class="host-opts">${p.map((orig, d) => `<div class="c${d}">${SHAPES[d]}<span>${rich(q.o[orig])}</span></div>`).join('')}</div>
      <div class="kq-center" style="flex:0;padding:6px 0">
        <div class="kq-counter"><div><b id="ansN">0</b><span>sudah menjawab</span></div><div><b id="plN">${this.players.length}</b><span>peserta</span></div></div>
        <button class="kq-btn ghost" id="hClose">Tutup soal sekarang</button>
      </div>`, '', this.title());
    on('#hClose', () => this.close());
    this.t0 = performance.now();
    this.timer = setInterval(() => this.tick(), 100);
  },
  paintCounter() {
    const a = $('#ansN'), b = $('#plN');
    if (a) a.textContent = this.answered.size;
    if (b) b.textContent = this.players.length;
  },
  tick() {
    const left = Math.max(0, this.T - (performance.now() - this.t0) / 1000);
    const bar = $('#tbar'), num = $('#tnum'); if (!bar) return;
    bar.style.transform = `scaleX(${left / this.T})`;
    const sec = Math.ceil(left); num.textContent = sec;
    if (sec <= 5) { num.classList.add('low'); if (sec !== this.lastSec && sec > 0) sfx.tick(); }
    this.lastSec = sec;
    if (left <= 0) this.close();
  },

  async close() {
    if (this.phase !== 'question') return;
    this.phase = 'closing'; clearInterval(this.timer);
    await sleep(900);   // beri waktu jawaban detik terakhir tiba di server
    try { await this.adv('result', this.qi); } catch (e) { this.phase = 'question'; toast('Gagal menutup soal', errMsg(e), '', '⚠️'); return; }
    let rows = [];
    try { rows = await sel('kq_answers', q => q.eq('room_pin', this.pin).eq('q_index', this.qi)); } catch (e) { }
    const q = this.Q[this.qi], p = this.perm[this.qi] || [0, 1, 2, 3];
    const counts = [0, 0, 0, 0]; this.lastPts = {};
    rows.forEach(r => { counts[r.choice]++; this.lastPts[r.user_id] = r.points; });
    const nOk = rows.filter(r => r.is_correct).length;
    this.phase = 'result'; sfx.ok();
    draw(`
      <div class="kq-center">
        <div class="kq-verdict" style="font-size:clamp(1.6rem,5vw,2.4rem)">${nOk} dari ${this.players.length} menjawab benar</div>
        ${distHtml(p, q.a, counts, Math.max(...counts, 1))}
        <div class="kq-exp"><b>Jawaban: ${rich(q.o[q.a])}</b><p>${rich(q.e || '')}</p></div>
        <button class="kq-btn light" id="toBoard" data-focus>Papan skor</button>
      </div>`, 'board', this.title());
    on('#toBoard', () => this.board());
  },

  async board() {
    this.phase = 'board';
    try { await this.adv('board', this.qi); } catch (e) { return failScreen(e, () => this.board()); }
    await this.refreshPlayers();
    const r = this.players.map(p => ({ name: (p.avatar || '') + ' ' + p.nickname, score: p.score, prev: p.score - (this.lastPts[p.user_id] || 0), me: false }));
    const last = this.qi >= this.Q.length - 1;
    draw(boardHtml(r, last), 'board', this.title());
    animateBoard();
    on('#nextQ', () => { if (last) this.final(); else { this.qi++; this.intro(); } });
  },

  async final() {
    this.phase = 'final';
    try { await this.adv('final', Math.min(this.qi, this.Q.length - 1)); } catch (e) { return failScreen(e, () => this.final()); }
    await this.refreshPlayers();
    clearInterval(this.poll);
    this.players = await withNim(this.pin, this.players);
    sfx.end(); confetti();
    const r = this.players.map(p => ({ name: (p.avatar || '') + ' ' + p.nickname, score: p.score, me: false }));
    award('host:' + this.pin, 30, 'Memandu sesi kelas'); giveBadge('host');
    LS.del('hosting');
    draw(`
      <div class="kq-center">
        <div class="kq-verdict" style="font-size:2rem">Hasil akhir kelas ${esc(this.cls)}</div>
        ${podiumHtml(r)}
        <div class="rk-table tw"><table>
          <thead><tr><th>#</th><th>Nama</th><th>NIM</th><th>Skor</th><th>Benar</th><th>Beruntun terbaik</th></tr></thead>
          <tbody>${this.players.map((p, i) => `<tr><td>${i + 1}</td><td>${esc((p.avatar || '') + ' ' + p.nickname)}</td><td>${esc(p.student_id || '')}</td><td>${idn(p.score)}</td><td>${p.correct}/${this.Q.length}</td><td>×${p.best_streak}</td></tr>`).join('')}</tbody>
        </table></div>
        <div class="btnrow">
          <button class="kq-btn light" id="hCsv" data-focus>Unduh nilai (CSV)</button>
          <button class="kq-btn ghost" id="hDone">Selesai</button>
        </div>
      </div>`, 'board', `Room ${fmtPin(this.pin)} | Selesai`);
    on('#hCsv', () => this.csv());
    on('#hDone', () => Stage.home());
  },
  csv() {
    const rows = [['Peringkat', 'Nama', 'NIM', 'Kelas', 'Skor', 'Benar', 'Jumlah soal', 'Dijawab', 'Beruntun terbaik', 'PIN', 'Materi', 'Tanggal']];
    const d = new Date().toLocaleString('id-ID');
    this.players.forEach((p, i) => rows.push([i + 1, p.nickname, p.student_id, p.class_code || this.cls, p.score, p.correct, this.Q.length, p.answered, p.best_streak, this.pin, this.course.title, d]));
    csvDownload(`nilai-${this.cls}-${this.course.mid}-${this.pin}.csv`, rows);
  }
};

/* =====================================================================
   11. Mode online: peserta
   Soal datang dari room (bukan dari file materi), kunci & pembahasan dibuka server setelah soal ditutup.
   ===================================================================== */
const Join = {
  pin: null, room: null, key: '', ch: null, poll: null, timer: null, off: 0, res: {}, pending: null, token: 0,
  Q: [], sections: {}, path: '', mid: '',

  stop() {
    clearInterval(this.poll); clearInterval(this.timer);
    removeCh(this.ch); this.ch = null; this.pin = null; this.key = ''; this.token++;
  },
  now() { return Date.now() + this.off; },

  form(pre) {
    this.stop();
    if (!profileReady('online')) return Stage.gate('online', () => this.form(pre));
    draw(`
      <div class="kq-center">
        <div class="kq-logo" style="font-size:clamp(1.8rem,5vw,2.8rem)">Gabung room</div>
        ${whoami()}
        <div class="kq-form">
          <input type="text" class="pin-in" id="jPin" inputmode="numeric" maxlength="7" placeholder="PIN" value="${esc(pre || '')}" aria-label="PIN room 6 angka" autocomplete="off" data-focus>
          <p class="err" id="jErr"></p>
          <button class="kq-btn" id="jGo">Masuk</button>
          <button class="kq-btn ghost" id="jBack" style="color:#46178F;background:#eee8fa">Kembali</button>
        </div>
      </div>`, '', 'Gabung room');
    on('#whoBtn', openProfile);
    on('#jBack', () => Stage.home());
    const go = () => {
      const pin = $('#jPin').value.replace(/\D/g, '');
      if (pin.length !== 6) return $('#jErr').textContent = 'PIN terdiri dari 6 angka.';
      this.join(pin);
    };
    on('#jGo', go);
    on('#jPin', e => { if (e.key === 'Enter') go(); }, 'keydown');
  },

  async join(pin) {
    this.stop();
    if (!profileReady('online')) return Stage.gate('online', () => this.join(pin));
    loading('Masuk ke room ' + fmtPin(pin) + '…', 'Gabung room');
    try {
      await sb();
      const t0 = Date.now();
      const info = await rpc('kq_join_room', { p_pin: pin, p_student_id: P.studentId, p_nickname: P.nickname, p_avatar: P.avatar, p_class: P.classCode });
      const t1 = Date.now();
      this.off = parseTs(info.server_now) - (t0 + t1) / 2;
      const [room] = await sel('kq_rooms', q => q.eq('pin', pin));
      if (!room) throw new Error('ROOM_NOT_FOUND');
      this.Q = roomQuestions(room);
      this.sections = room.sections || {};
      this.path = room.material_path || '';
      this.mid = room.material_id;
      this.pin = pin;
      this.res = LS.get('jres:' + pin, {});
      LS.set('joined', { pin, online: true, t: Date.now() });
      sfx.join();
      const c = await sb();
      this.ch = c.channel('kqp-' + pin + '-' + Math.random().toString(36).slice(2, 7))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kq_rooms', filter: 'pin=eq.' + pin }, p => this.apply(p.new))
        .subscribe();
      this.poll = setInterval(() => this.fetchRoom(), 2000);   // cadangan bila realtime tidak aktif
      this.apply(room);
    } catch (e) { failScreen(e, () => this.form(pin)); }
  },
  async fetchRoom() {
    if (!this.pin) return;
    try { const [r] = await sel('kq_rooms', q => q.eq('pin', this.pin)); if (r) this.apply(r); } catch (e) { }
  },
  async reveal() {
    try { mergeReveal(this.Q, await rpc('kq_room_reveal', { p_pin: this.pin })); } catch (e) { }
  },
  apply(room) {
    if (!this.pin || !room || room.pin !== this.pin) return;
    /* Realtime UPDATE hanya membawa kolom berubah pada sebagian konfigurasi; gabungkan dengan data lama */
    this.room = Object.assign({}, this.room && this.room.pin === room.pin ? this.room : {}, room);
    const key = this.room.status + ':' + this.room.q_index;
    if (key === this.key) return;
    this.key = key; this.token++;
    clearInterval(this.timer);
    const f = { lobby: 'wait', intro: 'intro', question: 'ask', result: 'result', board: 'board', final: 'final', closed: 'closed' }[this.room.status];
    if (f) this[f](this.token);
  },
  foot() {
    return `<div class="kq-foot"><span>${esc(P.avatar + ' ' + P.nickname)}</span><span>Room ${fmtPin(this.pin)}</span></div>`;
  },
  title() { const r = this.room; return r && r.q_index >= 0 ? `Soal ${r.q_index + 1}/${r.q_count}` : 'Room ' + fmtPin(this.pin); },

  wait() {
    draw(`
      <div class="kq-center">
        <span class="me-av" style="width:84px;height:84px;font-size:2.8rem;background:#fff">${P.avatar}</span>
        <div class="kq-verdict" style="font-size:2rem">Kamu sudah masuk!</div>
        <p class="kq-sub">Namamu tampil di layar pengajar sebagai <b>${esc(P.nickname)}</b>. Permainan dimulai sebentar lagi.</p>
        <div class="wait-dots" aria-hidden="true"><i></i><i></i><i></i></div>
        <button class="kq-btn ghost" id="jLeave">Keluar room</button>
      </div>${this.foot()}`, '', 'Room ' + fmtPin(this.pin));
    on('#jLeave', () => { LS.del('joined'); Stage.home(); });
  },
  intro() {
    const r = this.room, q = this.Q[r.q_index];
    if (!q) return this.mismatch();
    draw(`
      <div class="kq-center">
        <div class="kq-count">Soal ${r.q_index + 1} dari ${r.q_count}</div>
        ${q.hots ? '<div class="kq-hots">Soal HOTS: poin ganda</div>' : ''}
        <h2 class="kq-bigq">${rich(q.q)}</h2>
        <div class="kq-sub">Bersiap, pilihan jawaban segera muncul.</div>
        <div class="kq-introbar" aria-hidden="true"><i style="animation-duration:4s"></i></div>
      </div>${this.foot()}`, '', this.title());
  },
  mismatch() {
    draw(`<div class="kq-center"><div class="kq-verdict" style="font-size:1.8rem">Soal tidak ditemukan</div><p class="kq-sub">Data soal room ini tidak lengkap. Muat ulang halaman, lalu gabung lagi dengan PIN yang sama.</p><button class="kq-btn light" id="jHome" data-focus>Menu room</button></div>`, 'timeout');
    on('#jHome', () => Stage.home());
  },
  ask(tok) {
    const r = this.room, qi = r.q_index, q = this.Q[qi];
    if (!q) return this.mismatch();
    if (this.res[qi]) return this.sent(qi);
    const T = (r.times && r.times[qi]) || q.time;
    const end = parseTs(r.q_started_at) + T * 1000;
    if (end - this.now() <= 0) return this.lateWait();
    const p = (r.perm && r.perm[qi]) || [0, 1, 2, 3];
    draw(`
      <div class="kq-qbox">${rich(q.q)}</div>
      <div class="kq-timer"><div class="tnum" id="tnum">${Math.ceil((end - this.now()) / 1000)}</div><div class="tbar"><i id="tbar"></i></div></div>
      <div class="answers" id="answers">
        ${p.map((orig, d) => `<button class="ans c${d}" data-d="${d}" aria-label="${SHAPE_NAME[d]}: ${esc(plain(q.o[orig]))}">${SHAPES[d]}<span>${rich(q.o[orig])}</span></button>`).join('')}
      </div>${this.foot()}`, '', this.title());
    let locked = false, lastSec = T;
    const pick = d => {
      if (locked || tok !== this.token) return;
      locked = true; KEYPICK = null; clearInterval(this.timer);
      $('#answers').classList.add('locked');
      $(`[data-d="${d}"]`).classList.add('picked');
      this.submit(qi, p[d], d);
    };
    $$('.ans').forEach(b => b.addEventListener('click', () => pick(+b.dataset.d)));
    KEYPICK = pick;
    this.timer = setInterval(() => {
      const left = Math.max(0, (end - this.now()) / 1000);
      const bar = $('#tbar'), num = $('#tnum'); if (!bar || tok !== this.token) return clearInterval(this.timer);
      bar.style.transform = `scaleX(${left / T})`;
      const sec = Math.ceil(left); num.textContent = sec;
      if (sec <= 5) { num.classList.add('low'); if (sec !== lastSec && sec > 0) sfx.tick(); }
      lastSec = sec;
      if (left <= 0 && !locked) { locked = true; clearInterval(this.timer); KEYPICK = null; sfx.late(); this.lateWait(); }
    }, 100);
  },
  submit(qi, orig, disp) {
    const pin = this.pin;
    this.pending = rpc('kq_submit_answer', { p_pin: pin, p_q: qi, p_choice: orig })
      .then(res => { this.res[qi] = Object.assign({ choice: orig }, res); })
      .catch(e => {
        const m = String(e.message || e);
        if (/ALREADY_ANSWERED/.test(m)) { if (!this.res[qi]) this.res[qi] = { choice: orig, unknown: true }; }
        else { this.res[qi] = { choice: orig, late: true }; toast('Jawaban tidak tercatat', errMsg(e), '', '⚠️'); }
      })
      .finally(() => { LS.set('jres:' + pin, this.res); this.pending = null; });
    setTimeout(() => { if (this.key === 'question:' + qi) this.sent(qi, disp); }, 450);
  },
  sent(qi, disp) {
    const d = disp != null ? disp : Math.max(0, ((this.room.perm || [])[qi] || [0, 1, 2, 3]).indexOf((this.res[qi] || {}).choice));
    draw(`
      <div class="kq-center">
        <div class="ans c${d}" style="min-height:0;width:120px;height:120px;justify-content:center;pointer-events:none">${SHAPES[d]}</div>
        <div class="kq-verdict" style="font-size:2rem">Jawaban terkirim</div>
        <p class="kq-sub">Tunggu yang lain selesai menjawab. Hasilnya muncul bersamaan untuk semua peserta.</p>
        <div class="wait-dots" aria-hidden="true"><i></i><i></i><i></i></div>
      </div>${this.foot()}`, '', this.title());
  },
  lateWait() {
    draw(`<div class="kq-center"><div class="kq-verdict">Waktu habis</div><p class="kq-sub">Menunggu pengajar membuka hasil soal ini.</p><div class="wait-dots" aria-hidden="true"><i></i><i></i><i></i></div></div>${this.foot()}`, 'timeout', this.title());
  },
  async standing() {
    const rows = await sel('kq_room_players', q => q.eq('room_pin', this.pin).order('score', { ascending: false }));
    const i = rows.findIndex(p => p.user_id === UID);
    return { rows, i, me: rows[i] };
  },
  async result(tok) {
    if (this.pending) await this.pending;
    const r = this.room, qi = r.q_index, q = this.Q[qi];
    if (!q) return this.mismatch();
    let st = null;
    await this.reveal();
    try { st = await this.standing(); } catch (e) { }
    if (tok !== this.token) return;
    const res = this.res[qi];
    const timeout = !res || res.late, ok = !!(res && res.correct);
    const unknown = res && res.unknown;
    const mood = unknown ? 'board' : (timeout ? 'timeout' : (ok ? 'correct' : 'wrong'));
    unknown ? 0 : (timeout ? sfx.late() : (ok ? sfx.ok() : sfx.no()));
    draw(`
      <div class="kq-center">
        <div class="kq-verdict">${unknown ? 'Jawaban tercatat' : (timeout ? 'Waktu habis' : (ok ? 'Benar!' : 'Kurang tepat'))}</div>
        ${ok ? `<div class="kq-pts">+${idn(res.points)}</div>` : ''}
        ${ok && res.streak > 1 ? `<div class="kq-streak">Beruntun ×${res.streak}${res.bonus ? ` (bonus +${res.bonus})` : ''}</div>` : ''}
        ${Number.isInteger(q.a) ? `<div class="kq-exp"><b>Jawaban: ${rich(q.o[q.a])}</b><p>${rich(q.e || '')}</p></div>` : ''}
        ${st && st.me ? `<div class="kq-rank">Skor ${idn(st.me.score)} | Peringkat ${st.i + 1} dari ${st.rows.length}</div>` : ''}
        <p class="kq-sub">Lihat layar pengajar untuk papan skor.</p>
      </div>${this.foot()}`, mood, this.title());
  },
  async board(tok) {
    let st = null; try { st = await this.standing(); } catch (e) { }
    if (tok !== this.token) return;
    if (!st) return this.lateWait();
    const r = st.rows.map(p => ({ name: (p.avatar || '') + ' ' + p.nickname, score: p.score, prev: p.score, me: p.user_id === UID }));
    const above = st.i > 0 ? st.rows[st.i - 1] : null;
    const tip = st.me ? (st.i === 0 ? 'Kamu memimpin! Pertahankan.' : `Kurang ${idn(above.score - st.me.score)} poin untuk menyalip ${esc(above.nickname)}.`) : '';
    draw(boardHtml(r, false, false, `<p class="kq-sub">${tip} Menunggu soal berikutnya.</p>`), 'board', this.title());
  },
  async final(tok) {
    clearInterval(this.poll);
    let st = null;
    await this.reveal();
    try { st = await this.standing(); } catch (e) { }
    if (tok !== this.token) return;
    if (!st || !st.me) { LS.del('joined'); return this.closed(); }
    P = loadProfile();
    const me = st.me, rank = st.i + 1, n = this.room.q_count;
    const lvBefore = levelOf(P.xp);
    const rows = [['Ikut room sampai selesai', 30]];
    if (me.correct) rows.push([`${me.correct} jawaban benar`, me.correct * 10]);
    const pod = [0, 100, 60, 40][rank] || 0;
    if (pod) rows.push([`Peringkat ${rank} di kelas`, pod]);
    const key = 'online:' + this.pin;
    const fresh = !P.awarded[key];
    if (fresh) {
      P.awarded[key] = 1; P.games++; P.bestScore = Math.max(P.bestScore, me.score);
      addXp(rows.reduce((s, x) => s + x[1], 0));
    }
    const earned = [];
    const tryB = id => { if (giveBadge(id)) earned.push(id); };
    tryB('online'); tryB('first');
    if (rank <= 3) tryB('podium');
    if (rank === 1) tryB('champ');
    if (me.best_streak >= 5) tryB('streak5');
    if (me.best_streak >= 10) tryB('streak10');
    if (me.correct === n) tryB('perfect');
    sfx.end(); if (rank <= 3) confetti();
    LS.del('joined');
    const log = Object.keys(this.res).map(k => ({ i: +k, ok: !!this.res[k].correct, timeout: !!this.res[k].late, picked: this.res[k].choice })).filter(l => this.Q[l.i]).sort((a, b) => a.i - b.i);
    const r = st.rows.map(p => ({ name: (p.avatar || '') + ' ' + p.nickname, score: p.score, me: p.user_id === UID }));
    draw(`
      <div class="kq-center">
        <div class="kq-verdict" style="font-size:2rem">${rank === 1 ? 'Juara kelas!' : 'Hasil akhir'}</div>
        ${podiumHtml(r)}
        <p class="kq-sub"><b>Peringkatmu: ${rank} dari ${st.rows.length}.</b></p>
        <div class="stats">
          <div><b>${idn(me.score)}</b><span>Skor total</span></div>
          <div><b>${me.correct}/${n}</b><span>Jawaban benar</span></div>
          <div><b>×${me.best_streak}</b><span>Beruntun terbaik</span></div>
          <div><b>${rank}</b><span>Peringkat</span></div>
        </div>
        ${fresh ? xpBoxHtml(rows, lvBefore) : '<p class="kq-sub">XP untuk room ini sudah masuk ke profilmu.</p>'}
        ${earned.length ? `<div class="newb">${earned.map(id => `<span>${BADGE[id][1]} ${esc(BADGE[id][2])}</span>`).join('')}</div>` : ''}
        ${masteryHtml(log, this.Q, this.sections, this.path)}
        ${reviewHtml(log, this.Q)}
        <div class="btnrow">
          <button class="kq-btn light" id="jHome" data-focus>Menu room</button>
          ${this.path ? `<a class="kq-btn ghost" href="${esc(materiUrl(this.path))}" target="_blank" rel="noopener">Buka materinya</a>` : ''}
        </div>
      </div>`, 'board', 'Hasil akhir');
    animateXpBox();
    on('#jHome', () => Stage.home());
  },
  closed() {
    this.stop(); LS.del('joined');
    draw(`<div class="kq-center"><div class="kq-verdict" style="font-size:2rem">Room ditutup</div><p class="kq-sub">Pengajar sudah menutup room ini.</p><button class="kq-btn light" id="jHome" data-focus>Menu room</button></div>`, 'board', 'Room ditutup');
    on('#jHome', () => Stage.home());
  }
};

/* =====================================================================
   12. Peringkat kelas & rekap nilai
   Peringkat XP terbuka untuk anggota kelas; nilai per sesi hanya untuk perangkat yang memandu sesi itu.
   ===================================================================== */
const Rekap = {
  open(cls) {
    cls = (cls || P.classCode || CFG.defaultClass || '').toUpperCase();
    draw(`
      <div class="kq-center" style="justify-content:flex-start">
        <div class="kq-logo" style="font-size:clamp(1.8rem,5vw,2.6rem)">Peringkat & rekap</div>
        <div class="kq-form" style="flex-direction:row;width:min(460px,100%)">
          <input type="text" id="rkCls" maxlength="16" placeholder="Kode kelas" value="${esc(cls)}" aria-label="Kode kelas" style="flex:1;min-width:0" data-focus>
          <button class="kq-btn" id="rkGo">Tampilkan</button>
        </div>
        <div id="rk" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:14px"></div>
        <button class="kq-btn ghost" id="rkBack">Menu room</button>
      </div>`, 'board', 'Peringkat & rekap');
    const go = () => this.load($('#rkCls').value.trim().toUpperCase());
    on('#rkGo', go);
    on('#rkCls', e => { if (e.key === 'Enter') go(); }, 'keydown');
    on('#rkBack', () => Stage.home());
    if (CLASS_RE.test(cls)) this.load(cls);
  },
  async load(cls) {
    const box = $('#rk');
    if (!CLASS_RE.test(cls)) { box.innerHTML = `<p class="kq-sub">${esc(ERR.BAD_CLASS)}</p>`; return; }
    box.innerHTML = '<div class="wait-dots" aria-hidden="true"><i></i><i></i><i></i></div>';
    try {
      await sb();
      const [pro, rooms] = await Promise.all([
        sel('kq_profiles', q => q.eq('class_code', cls).order('xp', { ascending: false }).limit(50), PROFILE_COLS),
        sel('kq_rooms', q => q.eq('class_code', cls).eq('host_uid', UID).order('created_at', { ascending: false }).limit(40), 'pin,title,material_id,material_path,class_code,status,q_count,created_at')
      ]);
      const mx = Math.max(1, ...pro.map(p => p.xp));
      box.innerHTML = `
        <b>Peringkat XP kelas ${esc(cls)}</b>
        <div class="lb">${pro.map((p, i) => `<div class="lb-row ${p.user_id === UID ? 'me' : ''}"><div class="lb-fill" data-w="${Math.max(4, p.xp / mx * 100)}" style="width:0"></div><span class="lb-rank">${i + 1}</span><span class="lb-name">${esc((p.avatar || '') + ' ' + p.nickname)}${p.user_id === UID ? ' (kamu)' : ''} <small style="opacity:.8">Lv ${levelOf(p.xp)} | ${(p.badges || []).length} lencana</small></span><span class="lb-score">${idn(p.xp)} XP</span></div>`).join('') || '<p class="kq-sub">Belum ada profil dengan kode kelas ini.</p>'}</div>
        <b>Sesi room yang kamu pandu</b>
        <div class="rk-list">${rooms.map(r => `<button data-pin="${esc(r.pin)}"><b>${esc(r.title || r.material_id)}</b><span>PIN ${fmtPin(r.pin)}</span><span>${new Date(r.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} | ${r.q_count} soal</span><span>${r.status === 'final' ? 'Selesai' : (r.status === 'closed' ? 'Ditutup' : 'Berjalan')}</span></button>`).join('') || '<p class="kq-sub">Belum ada sesi kelas ini yang dipandu dari perangkat ini.</p>'}</div>`;
      animateBoard();
      $$('[data-pin]', box).forEach(b => b.addEventListener('click', () => this.room(rooms.find(r => r.pin === b.dataset.pin))));
    } catch (e) { box.innerHTML = `<p class="kq-sub">${esc(errMsg(e))}</p>`; }
  },
  async room(room) {
    loading('Memuat nilai sesi…', 'Rekap');
    try {
      const ps = await withNim(room.pin, await sel('kq_room_players', q => q.eq('room_pin', room.pin).order('score', { ascending: false })));
      draw(`
        <div class="kq-center" style="justify-content:flex-start">
          <div class="kq-verdict" style="font-size:1.6rem">${esc(room.title || room.material_id)}</div>
          <p class="kq-sub">Kelas ${esc(room.class_code)} | PIN ${fmtPin(room.pin)} | ${new Date(room.created_at).toLocaleString('id-ID')} | ${ps.length} peserta</p>
          <div class="rk-table tw"><table>
            <thead><tr><th>#</th><th>Nama</th><th>NIM</th><th>Skor</th><th>Benar</th><th>Dijawab</th><th>Beruntun</th></tr></thead>
            <tbody>${ps.map((p, i) => `<tr><td>${i + 1}</td><td>${esc((p.avatar || '') + ' ' + p.nickname)}</td><td>${esc(p.student_id || '')}</td><td>${idn(p.score)}</td><td>${p.correct}/${room.q_count}</td><td>${p.answered}</td><td>×${p.best_streak}</td></tr>`).join('') || '<tr><td colspan="7">Tidak ada peserta.</td></tr>'}</tbody>
          </table></div>
          <div class="btnrow">
            <button class="kq-btn light" id="rkCsv" data-focus>Unduh CSV</button>
            <button class="kq-btn ghost" id="rkBack2">Kembali</button>
          </div>
        </div>`, 'board', 'Rekap sesi');
      on('#rkCsv', () => {
        const rows = [['Peringkat', 'Nama', 'NIM', 'Kelas', 'Skor', 'Benar', 'Jumlah soal', 'Dijawab', 'Beruntun terbaik', 'PIN', 'Materi', 'Tanggal']];
        const d = new Date(room.created_at).toLocaleString('id-ID');
        ps.forEach((p, i) => rows.push([i + 1, p.nickname, p.student_id, p.class_code || room.class_code, p.score, p.correct, room.q_count, p.answered, p.best_streak, room.pin, room.title || room.material_id, d]));
        csvDownload(`nilai-${room.class_code}-${room.material_id}-${room.pin}.csv`, rows);
      });
      on('#rkBack2', () => this.open(room.class_code));
    } catch (e) { failScreen(e, () => this.open(room.class_code)); }
  }
};

/* =====================================================================
   13. Keyboard, koneksi, inisialisasi
   ===================================================================== */
document.addEventListener('keydown', e => {
  if (!KEYPICK || $('#view-quiz').hidden) return;
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  const idx = ['1', '2', '3', '4'].indexOf(k) >= 0 ? +k - 1 : ['a', 'b', 'c', 'd'].indexOf(k);
  if (idx >= 0) { e.preventDefault(); KEYPICK(idx); }
});

/* Perubahan koneksi: segarkan tombol online */
function onNetChange() {
  const live = Host.phase !== 'idle' || Join.pin;
  toast(navigator.onLine ? 'Kembali online' : 'Koneksi terputus',
        navigator.onLine ? 'Mode room online tersedia lagi.' : (live ? 'Sesi online terhenti sampai koneksi kembali.' : 'Materi tetap bisa dibuka untuk latihan solo.'),
        '', navigator.onLine ? '📶' : '✈️');
  if (navigator.onLine) queueSync();
  Home.render();
  if (!live && !$('#view-quiz').hidden && $('#kq-root').querySelector('.modes')) Stage.home();
}
window.addEventListener('online', onNetChange);
window.addEventListener('offline', onNetChange);
/* XP dari tab materi lain (origin sama) langsung tampil di sini */
window.addEventListener('storage', e => { if (e.key === 'kq:profile') { P = loadProfile(); refreshChip(); } });

function init() {
  buildShell();
  Home.render();
  const up = $('#catFile');
  if (up) up.addEventListener('change', () => { const f = up.files[0]; up.value = ''; if (f) Host.pickFile(f); });
  if (netOK() && profileReady('online')) setTimeout(queueSync, 2500);
  openHash();
  /* Tautan #join=PIN / #room saat hub sudah terbuka hanya mengubah hash, tanpa memuat ulang */
  window.addEventListener('hashchange', openHash);
}
function openHash() {
  const m = location.hash.match(/join=(\d{6})/);
  if (m && netOK() && Join.pin !== m[1]) { showView('quiz'); Join.form(m[1]); }
  else if (location.hash === '#room') { showView('quiz'); if (Host.phase === 'idle' && !Join.pin) Stage.home(); }
}

window.KQOnline = { version: VERSION, online: () => netOK(), materi: Materi };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
