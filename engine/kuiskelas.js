/*!
 * KuisKelas engine v2.0.0 (offline)
 * Mesin tampilan materi + kuis gaya Kahoot + profil, XP, dan lencana. Berjalan penuh tanpa internet.
 * Materi cukup menyediakan: window.KQ_CONFIG, window.COURSE, dan <main id="view-summary">.
 * Mode online (room PIN, peringkat kelas, rekap nilai) ada di KuisKelas Online (index.html di
 * root repo), yang membaca soal langsung dari file materi ini tanpa mengubahnya.
 * Sumber: engine/kuiskelas.js. Jangan ubah per materi; sebarkan dengan tools/kuiskelas.py sync.
 */
(function () {
'use strict';

/* =====================================================================
   0. Konfigurasi & data
   ===================================================================== */
const VERSION = '2.0.0';
const CFG = Object.assign({
  defaultClass: '',
  bots: 12
}, window.KQ_CONFIG || {});
const C = window.COURSE || {};
const Q = (Array.isArray(C.questions) ? C.questions : []).map(q => Object.assign({ time: q.hots ? 40 : 20 }, q));
const MID = String(C.id || document.title || 'materi').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'materi';
const TITLE = C.short || C.title || document.title || 'Materi';
const CLASS_RE = /^[A-Z0-9-]{2,16}$/;

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
const shuffle4 = () => { const p = [0, 1, 2, 3]; for (let k = 3; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [p[k], p[j]] = [p[j], p[k]]; } return p; };
const today = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

const LS = {
  get(k, d) { try { const v = localStorage.getItem('kq:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('kq:' + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem('kq:' + k); } catch (e) { } }
};

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
const BOT_NAMES = ['Ayu', 'Bima88', 'Nora', 'Rafi_R', 'Sinta', 'Dimas', 'Lena', 'Citra', 'Fajar404', 'Wulan', 'Gilang', 'Putri.K', 'Bayu_B', 'Rina', 'Kevin', 'Salsa', 'Yoga', 'Tiara'];

const BAD_CLASS = 'Kode kelas hanya boleh huruf kapital, angka, dan tanda minus (2–16 karakter).';

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
   3. Profil, XP, level, lencana
   ===================================================================== */
const P0 = { nickname: '', studentId: '', classCode: CFG.defaultClass ? String(CFG.defaultClass).toUpperCase() : '', avatar: AVATARS[0], xp: 0, badges: [], awarded: {}, games: 0, bestScore: 0, dayStreak: 0, lastDay: '', read: {}, labs: {} };
let P = Object.assign({}, P0, LS.get('profile', {}));
P.read = P.read || {}; P.labs = P.labs || {}; P.awarded = P.awarded || {}; P.badges = P.badges || [];
const saveP = () => { LS.set('profile', P); refreshChip(); };

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
/* XP sekali saja per kunci (misal membaca bab yang sama tidak memberi XP dua kali) */
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
function profileReady() {
  return !!P.nickname;
}
function dailyCheckIn() {
  const t = today();
  if (P.lastDay === t) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  P.dayStreak = P.lastDay === today(y) ? (P.dayStreak || 0) + 1 : 1;
  P.lastDay = t;
  saveP();
  setTimeout(() => {
    award('day:' + t, 10, P.dayStreak > 1 ? 'Hadir ' + P.dayStreak + ' hari berturut-turut' : 'Hadir hari ini');
    if (P.dayStreak >= 3) giveBadge('day3');
    if (P.dayStreak >= 7) giveBadge('day7');
  }, 1200);
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
   5. Unduhan CSV (dipakai tabel data)
   ===================================================================== */
function csvDownload(name, rows) {
  const s = rows.map(r => r.map(v => { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + s], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* =====================================================================
   6. Kerangka halaman (header, tab, panggung kuis, dialog)
   ===================================================================== */
function buildShell() {
  $$('header.top').forEach(h => h.remove());   // hindari header ganda bila materi menulis sendiri
  const header = document.createElement('header');
  header.className = 'top';
  header.innerHTML = `
    <div class="top-in">
      <div class="brand">${esc(TITLE)}</div>
      <div class="top-r">
        <div class="tabs" role="tablist" aria-label="Pilih tampilan">
          <button class="tab" role="tab" data-view="summary" aria-selected="true">Rangkuman</button>
          <button class="tab" role="tab" data-view="quiz" aria-selected="false">Kuis</button>
        </div>
        <button class="me-chip" id="meChip" aria-haspopup="dialog" aria-label="Profil dan pencapaian">
          <span class="me-av" id="meAv"></span>
          <span class="me-lv"><b id="meLv"></b><span class="me-bar"><i id="meBar"></i></span></span>
        </button>
      </div>
    </div>`;
  document.body.insertBefore(header, document.body.firstChild);

  let quiz = $('#view-quiz');
  if (!quiz) {
    quiz = document.createElement('section');
    quiz.id = 'view-quiz'; quiz.hidden = true; quiz.setAttribute('aria-label', 'Kuis');
    const main = $('#view-summary');
    (main && main.parentNode ? main.parentNode : document.body).insertBefore(quiz, main ? main.nextSibling : null);
  }
  quiz.innerHTML = `
    <div class="kq-stage">
      <div class="kq-bar">
        <span class="kq-pill" id="kqTitle">Kuis</span>
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
  const pr = $('#tocProg');
  if (pr) paintReadProgress();
}

function showView(v) {
  $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === v)));
  const s = $('#view-summary'), q = $('#view-quiz');
  if (s) s.hidden = v !== 'summary';
  q.hidden = v !== 'quiz';
  if (v === 'quiz') {
    if (!$('#kq-root').children.length) Quiz.home();
    document.body.style.background = MOODS[q.dataset.mood || ''];
  } else {
    Solo.abort();
    document.body.style.background = '';
  }
  window.scrollTo(0, 0);
}

/* =====================================================================
   7. Rangkuman: daftar isi, checkpoint bab, lab, bank soal
   ===================================================================== */
let SECTIONS = [], LABS = [];
function enhanceSummary() {
  const art = $('#view-summary article');
  const toc = $('#view-summary nav.toc');
  const secs = art ? $$(':scope > section[id]', art) : [];

  if (toc && !toc.querySelector('a')) {
    toc.innerHTML = '<b>Daftar isi</b>' + secs.map(s => {
      const h = s.querySelector('h2');
      const label = s.dataset.toc || (h ? h.textContent : s.id);
      return `<a href="#${esc(s.id)}">${esc(label)}</a>`;
    }).join('');
  }

  SECTIONS = secs.filter(s => !s.hasAttribute('data-nocheck') && !s.querySelector('#bank'));
  const done = P.read[MID] || {};
  SECTIONS.forEach(s => {
    const h = s.querySelector('h2');
    const ck = document.createElement('div');
    ck.className = 'ck' + (done[s.id] ? ' done' : '');
    ck.innerHTML = done[s.id]
      ? `<span>Bab ini sudah kamu tandai paham.</span><button disabled>Selesai ✓</button>`
      : `<span>Sudah paham isi bab ini?</span><button type="button">Tandai paham (+20 XP)</button>`;
    s.appendChild(ck);
    const btn = ck.querySelector('button:not([disabled])');
    if (btn) btn.addEventListener('click', () => {
      P.read[MID] = P.read[MID] || {}; P.read[MID][s.id] = 1;
      award(MID + ':read:' + s.id, 20, 'Bab selesai: ' + (h ? plain(h.textContent).slice(0, 48) : s.id));
      ck.className = 'ck done';
      ck.innerHTML = `<span>Bab ini sudah kamu tandai paham.</span><button disabled>Selesai ✓</button>`;
      sfx.xp(); paintReadProgress();
      if (SECTIONS.every(x => P.read[MID][x.id])) { if (giveBadge('reader')) confetti(); }
    });
  });

  if (toc && SECTIONS.length) {
    const pr = document.createElement('div');
    pr.className = 'prog'; pr.id = 'tocProg';
    const b = toc.querySelector('b');
    b ? b.after(pr) : toc.prepend(pr);
    paintReadProgress();
  }

  /* Lab: 3 interaksi pertama = lab dianggap dicoba (+15 XP sekali) */
  LABS = $$('#view-summary .lab, #view-summary [data-lab]').filter(l => !l.hasAttribute('data-noxp'));
  LABS.forEach((lab, i) => {
    const id = lab.dataset.lab || lab.id || ('lab' + (i + 1));
    lab.dataset.lab = id;
    const tried = (P.labs[MID] || {})[id];
    const h = lab.querySelector('h4, h3, h2');
    if (h) { const pill = document.createElement('span'); pill.className = 'lab-xp'; pill.textContent = tried ? 'Dicoba ✓' : '+15 XP'; h.prepend(pill); }
    if (tried) { lab.classList.add('tried'); return; }
    let n = 0;
    const hit = () => {
      if (++n < 3 || lab.classList.contains('tried')) return;
      lab.classList.add('tried');
      P.labs[MID] = P.labs[MID] || {}; P.labs[MID][id] = 1;
      const pill = lab.querySelector('.lab-xp'); if (pill) pill.textContent = 'Dicoba ✓';
      award(MID + ':lab:' + id, 15, 'Lab dicoba: ' + (h ? plain(h.textContent).replace(/^\+15 XP|Dicoba ✓/, '').trim().slice(0, 40) : id));
      if (LABS.every(l => (P.labs[MID] || {})[l.dataset.lab])) giveBadge('labrat');
    };
    ['input', 'click', 'change'].forEach(ev => lab.addEventListener(ev, e => { if (e.target !== lab) hit(); }));
  });

  /* Bank soal */
  const bank = $('#bank');
  if (bank) bank.innerHTML = Q.map((q, i) => `
    <details class="bank-item"><summary>${q.hots ? '<span class="hots-tag">HOTS</span>' : ''}Soal ${i + 1}. ${rich(q.q)}</summary>
      <ol>${q.o.map((t, k) => `<li class="${k === q.a ? 'key' : ''}">${rich(t)}${k === q.a ? ' (Kunci)' : ''}</li>`).join('')}</ol>
      <p><b>Pembahasan:</b> ${rich(q.e)}</p>
    </details>`).join('');

  $$('[data-go-quiz], #goQuiz').forEach(b => b.addEventListener('click', () => showView('quiz')));

  /* Penanda bab aktif di daftar isi */
  if (toc && 'IntersectionObserver' in window) {
    const links = $$('a', toc);
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(es => {
      es.forEach(en => { if (en.isIntersecting) { links.forEach(l => l.classList.remove('on')); const a = map.get(en.target.id); if (a) a.classList.add('on'); } });
    }, { rootMargin: '-20% 0px -70% 0px' });
    map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
}
function paintReadProgress() {
  const pr = $('#tocProg'); if (!pr) return;
  const done = P.read[MID] || {};
  const n = SECTIONS.filter(s => done[s.id]).length;
  pr.innerHTML = `Progres baca ${n}/${SECTIONS.length}<div class="me-bar"><i style="width:${SECTIONS.length ? n / SECTIONS.length * 100 : 0}%"></i></div>`;
  $$('#view-summary nav.toc a').forEach(a => a.classList.toggle('done', !!done[a.getAttribute('href').slice(1)]));
}
function goSection(id) {
  showView('summary');
  const el = document.getElementById(id);
  if (el) setTimeout(() => el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' }), 60);
}

/* Validasi data soal agar kesalahan pembuatan materi langsung terlihat */
function validate() {
  const bad = [];
  if (!Q.length) bad.push('COURSE.questions kosong.');
  Q.forEach((q, i) => {
    const n = 'Soal ' + (i + 1) + ': ';
    if (!q.q) bad.push(n + 'teks soal (q) kosong');
    if (!Array.isArray(q.o) || q.o.length !== 4) bad.push(n + 'opsi (o) harus tepat 4');
    if (!(Number.isInteger(q.a) && q.a >= 0 && q.a <= 3)) bad.push(n + 'kunci (a) harus 0–3');
    if (!q.e) bad.push(n + 'pembahasan (e) kosong');
    if (q.ref && !document.getElementById(q.ref)) bad.push(n + 'ref "' + q.ref + '" tidak cocok dengan id bab mana pun');
  });
  if (bad.length) {
    console.warn('[KuisKelas] Data materi perlu diperiksa:\n' + bad.join('\n'));
    const m = $('#view-summary .wrap') || $('#view-summary');
    if (m) {
      const b = document.createElement('div');
      b.className = 'note warn'; b.style.margin = '16px 0';
      b.innerHTML = '<p><b>Data materi perlu diperiksa.</b> ' + esc(bad.slice(0, 6).join('; ')) + (bad.length > 6 ? ' …' : '') + '</p>';
      m.prepend(b);
    }
  }
  return bad;
}

/* =====================================================================
   8. Dialog profil & pencapaian
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
      <div class="dlg-act">
        <button type="button" class="btn-s danger" id="dlgReset">Hapus profil di perangkat ini</button>
        <button type="button" class="btn-s" id="dlgSave">Simpan profil</button>
      </div>
    </form>`;
  bindAvatarPicker(d, a => { av = a; $('#dlgAv').textContent = a; });
  $('#dlgSave').addEventListener('click', () => {
    const f = readProfileForm(d);
    if (!f.nickname) { $('#dlgErr').textContent = 'Isi nama panggilan terlebih dahulu.'; return; }
    if (f.classCode && !CLASS_RE.test(f.classCode)) { $('#dlgErr').textContent = BAD_CLASS; return; }
    Object.assign(P, f, { avatar: av }); saveP();
    d.close(); toast('Profil tersimpan', P.nickname + (P.classCode ? ' | ' + P.classCode : ''), '', P.avatar);
  });
  $('#dlgReset').addEventListener('click', () => {
    if (!confirm('Hapus profil, XP, dan lencana di perangkat ini? Tindakan ini tidak bisa dibatalkan.')) return;
    P = Object.assign({}, P0, { read: {}, labs: {}, awarded: {}, badges: [] }); LS.set('profile', P); refreshChip(); d.close();
    location.reload();
  });
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}
/* =====================================================================
   9. Panggung kuis: layar awal, profil singkat
   ===================================================================== */
let KEYPICK = null;   // fungsi pemilih jawaban aktif (untuk tombol 1–4 / A–D)
function draw(html, mood, title) {
  KEYPICK = null;
  $('#kq-root').innerHTML = html;
  const q = $('#view-quiz');
  q.dataset.mood = mood || '';
  if (!q.hidden) document.body.style.background = MOODS[mood || ''];
  $('#kqTitle').textContent = title || TITLE;
  const f = $('#kq-root [data-focus]'); if (f && !q.hidden) f.focus({ preventScroll: true });
}
const on = (sel, fn, ev = 'click') => { const el = $(sel); if (el) el.addEventListener(ev, fn); return el; };
function whoami() {
  const lp = lvProgress(P.xp);
  return `<button class="whoami" id="whoBtn" aria-label="Buka profil"><span class="me-av">${P.avatar}</span><span style="text-align:left">${esc(P.nickname)}<small>Lv ${lp.n} ${esc(lvName(lp.n))} | ${idn(P.xp)} XP</small><span class="me-bar"><i style="width:${lp.pct}%"></i></span></span></button>`;
}

const Quiz = {
  home() {
    Solo.abort();
    if (!profileReady()) return this.gate(() => this.home());
    const nH = Q.filter(x => x.hots).length;
    draw(`
      <div class="kq-center">
        <div class="kq-logo">${esc(TITLE)}</div>
        ${whoami()}
        <p class="kq-sub">${Q.length} soal: ${Q.length - nH} reguler${nH ? ` dan ${nH} HOTS dengan poin ganda` : ''}. Makin cepat menjawab benar, makin besar poinnya. Setiap permainan menambah XP profilmu.</p>
        <div class="modes one">
          <button class="mode c0" id="mSolo" data-focus>${SHAPES[0].replace('<svg', '<svg class="shape"')}<b>Latihan solo</b><span>Bertanding melawan ${CFG.bots} bot. Cocok untuk belajar mandiri kapan saja, juga tanpa internet.</span></button>
        </div>
        <p class="offline-note">Ingin main bareng satu kelas dengan PIN? Pengajar bisa membuka materi ini lewat KuisKelas Online; XP dan lencanamu tetap terhitung.</p>
      </div>`, '', TITLE);
    on('#whoBtn', openProfile);
    on('#mSolo', () => Solo.lobby());
  },

  /* Formulir profil singkat di panggung kuis */
  gate(next) {
    let av = P.avatar;
    draw(`
      <div class="kq-center">
        <div class="kq-logo" style="font-size:clamp(1.8rem,5vw,2.6rem)">Buat profil</div>
        <p class="kq-sub">Profil tersimpan di perangkat ini dan mengumpulkan XP, level, serta lencana dari semua materi.</p>
        <div class="kq-form" id="gateForm">
          ${avatarPicker(av)}
          <input type="text" name="nick" maxlength="24" placeholder="Nama panggilan" value="${esc(P.nickname)}" aria-label="Nama panggilan" autocomplete="nickname" data-focus>
          <div class="row2">
            <input type="text" name="nim" maxlength="24" placeholder="NIM (opsional)" value="${esc(P.studentId)}" aria-label="NIM atau ID siswa" autocomplete="off">
            <input type="text" name="cls" maxlength="16" placeholder="Kode kelas (opsional)" value="${esc(P.classCode)}" aria-label="Kode kelas" autocomplete="off">
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
      if (f.classCode && !CLASS_RE.test(f.classCode)) return err.textContent = BAD_CLASS;
      Object.assign(P, f, { avatar: av }); saveP();
      next();
    };
    on('#gSave', save);
    $$('input', root).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') save(); }));
  }
};

/* =====================================================================
   10. Mode solo melawan bot
   ===================================================================== */
const pts = (dt, T, hots) => Math.round((1 - (dt / T) / 2) * 1000) * (hots ? 2 : 1);
const streakBonus = s => s > 1 ? Math.min(s - 1, 5) * 100 : 0;

const Solo = {
  phase: 'idle', i: 0, perm: [], bots: [], me: null, timer: null, intro: null, t0: 0, T: 20, locked: false, lastSec: 0,
  clear() { clearInterval(this.timer); clearTimeout(this.intro); this.timer = this.intro = null; },
  abort() { if (this.phase !== 'idle') { this.clear(); this.phase = 'idle'; } },

  lobby() {
    this.clear(); this.phase = 'lobby';
    const shuffle = LS.get('shuffle', true);
    draw(`
      <div class="kq-center">
        <div class="kq-logo">Latihan solo</div>
        <div class="kq-pin"><small>Game PIN</small><b>${Math.floor(100000 + Math.random() * 900000)}</b></div>
        <p class="kq-sub">Kamu melawan ${CFG.bots} bot dengan kemampuan berbeda. Tekan 1–4 atau A–D di keyboard sesuai urutan warna.</p>
        <div class="kq-form">
          <label class="opt"><input type="checkbox" id="optShuffle" ${shuffle ? 'checked' : ''}> Acak posisi jawaban tiap soal</label>
          <button class="kq-btn" id="startBtn" data-focus>Mulai sebagai ${esc(P.nickname)}</button>
          <button class="kq-btn ghost" id="backBtn" style="color:#46178F;background:#eee8fa">Kembali</button>
        </div>
      </div>`, '', 'Latihan solo');
    on('#startBtn', () => this.start());
    on('#backBtn', () => Quiz.home());
  },

  start() {
    const sh = $('#optShuffle').checked; LS.set('shuffle', sh);
    this.perm = Q.map(() => sh ? shuffle4() : [0, 1, 2, 3]);
    const names = (Array.isArray(C.bots) && C.bots.length ? C.bots : BOT_NAMES).slice().sort(() => Math.random() - .5);
    this.bots = Array.from({ length: CFG.bots }, (_, k) => ({ name: names[k % names.length] + (k >= names.length ? '_' + k : ''), skill: .4 + Math.random() * .5, speed: .12 + Math.random() * .5, score: 0, prev: 0, streak: 0 }));
    this.me = { name: P.nickname, score: 0, prev: 0, streak: 0, best: 0, correct: 0, time: 0, answered: 0, log: [], worst: 1 };
    this.i = 0;
    sfx.start();
    this.introQ();
  },

  introQ() {
    const q = Q[this.i]; this.T = q.time; this.phase = 'intro';
    draw(`
      <div class="kq-center">
        <div class="kq-count">Soal ${this.i + 1} dari ${Q.length}</div>
        ${q.hots ? '<div class="kq-hots">Soal HOTS: poin ganda</div>' : ''}
        <h2 class="kq-bigq">${rich(q.q)}</h2>
        <div class="kq-sub">Waktu menjawab: ${q.time} detik</div>
        <div class="kq-introbar" aria-hidden="true"><i></i></div>
        <button class="kq-btn ghost" id="skipIntro" data-focus>Langsung jawab</button>
      </div>`, '', `Soal ${this.i + 1}/${Q.length}`);
    on('#skipIntro', () => { this.clear(); this.ask(); });
    this.intro = setTimeout(() => this.ask(), 3000);
  },

  ask() {
    const q = Q[this.i], p = this.perm[this.i];
    this.clear(); this.phase = 'ask'; this.locked = false; this.lastSec = this.T;
    draw(`
      <div class="kq-qbox">${rich(q.q)}</div>
      <div class="kq-timer"><div class="tnum" id="tnum" aria-label="Sisa waktu">${this.T}</div><div class="tbar"><i id="tbar"></i></div></div>
      <div class="answers" id="answers">
        ${p.map((orig, d) => `<button class="ans c${d}" data-d="${d}" aria-label="${SHAPE_NAME[d]}: ${esc(plain(q.o[orig]))}">${SHAPES[d]}<span>${rich(q.o[orig])}</span></button>`).join('')}
      </div>
      <div class="kq-foot"><span>${esc(P.avatar + ' ' + this.me.name)}</span><span>Skor ${idn(this.me.score)}${this.me.streak > 1 ? ' | Beruntun ×' + this.me.streak : ''}</span></div>`,
      '', `Soal ${this.i + 1}/${Q.length}`);
    $$('.ans').forEach(b => b.addEventListener('click', () => this.pick(+b.dataset.d)));
    KEYPICK = d => this.pick(d);
    this.t0 = performance.now();
    this.timer = setInterval(() => this.tick(), 100);
  },

  tick() {
    const left = Math.max(0, this.T - (performance.now() - this.t0) / 1000);
    const bar = $('#tbar'), num = $('#tnum'); if (!bar) return;
    bar.style.transform = `scaleX(${left / this.T})`;
    const sec = Math.ceil(left);
    num.textContent = sec;
    if (sec <= 5) { num.classList.add('low'); if (sec !== this.lastSec && sec > 0) sfx.tick(); }
    this.lastSec = sec;
    if (left <= 0) this.finish(null, this.T);
  },

  pick(d) {
    if (this.locked || this.phase !== 'ask') return;
    const dt = Math.min(this.T, (performance.now() - this.t0) / 1000);
    this.locked = true; clearInterval(this.timer); KEYPICK = null;
    const ans = $('#answers'); ans.classList.add('locked');
    ans.querySelector(`[data-d="${d}"]`).classList.add('picked');
    setTimeout(() => this.finish(d, dt), 650);
  },

  finish(d, dt) {
    this.clear(); this.phase = 'result';
    const q = Q[this.i], p = this.perm[this.i], me = this.me;
    const picked = d === null ? -1 : p[d];
    const ok = picked === q.a;
    let base = 0, bonus = 0;
    me.prev = me.score;
    if (ok) { me.streak++; me.correct++; base = pts(dt, this.T, q.hots); bonus = streakBonus(me.streak); me.best = Math.max(me.best, me.streak); }
    else me.streak = 0;
    if (d !== null) { me.time += dt; me.answered++; }
    me.score += base + bonus;
    const counts = [0, 0, 0, 0]; if (picked >= 0) counts[picked]++;
    this.bots.forEach(b => {
      b.prev = b.score;
      const right = Math.random() < b.skill * (q.hots ? .75 : 1);
      const rt = Math.min(.97, Math.max(.06, b.speed + (Math.random() - .5) * .4)) * this.T;
      if (right) { b.streak++; b.score += pts(rt, this.T, q.hots) + streakBonus(b.streak); counts[q.a]++; }
      else { b.streak = 0; const w = [0, 1, 2, 3].filter(x => x !== q.a); counts[w[Math.floor(Math.random() * 3)]]++; }
    });
    me.log.push({ i: this.i, picked, ok, timeout: d === null, pts: base + bonus, dt });
    const rank = this.ranking().findIndex(x => x.me) + 1;
    if (this.i >= 2) me.worst = Math.max(me.worst, rank);

    const mood = d === null ? 'timeout' : (ok ? 'correct' : 'wrong');
    d === null ? sfx.late() : (ok ? sfx.ok() : sfx.no());
    const mx = Math.max(...counts, 1);
    draw(`
      <div class="kq-center">
        <div class="kq-verdict">${d === null ? 'Waktu habis' : (ok ? 'Benar!' : 'Kurang tepat')}</div>
        ${ok ? `<div class="kq-pts">+${idn(base + bonus)}</div>` : ''}
        ${ok && me.streak > 1 ? `<div class="kq-streak">Beruntun ×${me.streak}${bonus ? ` (bonus +${bonus})` : ''}</div>` : ''}
        ${distHtml(p, q.a, counts, mx)}
        <div class="kq-exp"><b>Jawaban: ${rich(q.o[q.a])}</b><p>${rich(q.e)}</p></div>
        <div class="kq-rank">Skor ${idn(me.score)} | Peringkat ${rank} dari ${this.bots.length + 1}</div>
        <button class="kq-btn light" id="toBoard" data-focus>Papan skor</button>
      </div>`, mood, `Soal ${this.i + 1}/${Q.length}`);
    on('#toBoard', () => this.board());
  },

  ranking() {
    const all = this.bots.map(b => ({ name: b.name, score: b.score, prev: b.prev, me: false }));
    all.push({ name: P.avatar + ' ' + this.me.name, score: this.me.score, prev: this.me.prev, me: true });
    return all.sort((a, b) => b.score - a.score || (a.me ? -1 : 1));
  },

  board() {
    this.phase = 'board';
    const last = this.i === Q.length - 1;
    draw(boardHtml(this.ranking(), last), 'board', `Soal ${this.i + 1}/${Q.length}`);
    animateBoard();
    on('#nextQ', () => { if (last) this.final(); else { this.i++; this.introQ(); } });
  },

  final() {
    this.phase = 'final'; sfx.end();
    const r = this.ranking(), me = this.me, myRank = r.findIndex(x => x.me) + 1;
    const acc = Math.round(me.correct / Q.length * 100);
    const avgT = me.answered ? me.time / me.answered : 0;

    /* XP: soal yang pertama kali benar +10, ulangan +2, selesai +20, podium bonus */
    let firstRight = 0, repeatRight = 0;
    me.log.forEach(l => { if (!l.ok) return; const k = MID + ':q:' + l.i; if (!P.awarded[k]) { P.awarded[k] = 1; firstRight++; } else repeatRight++; });
    const rows = [['Selesai bermain', 20]];
    if (firstRight) rows.push([`${firstRight} soal benar pertama kali`, firstRight * 10]);
    if (repeatRight) rows.push([`${repeatRight} soal benar (ulangan)`, repeatRight * 2]);
    const pod = [0, 40, 25, 15][myRank] || 0;
    if (pod) rows.push([`Podium peringkat ${myRank}`, pod]);
    const lvBefore = levelOf(P.xp);
    const gained = rows.reduce((s, x) => s + x[1], 0);
    P.games++; P.bestScore = Math.max(P.bestScore, me.score);
    addXp(gained);

    const earned = [];
    const tryB = id => { if (giveBadge(id)) earned.push(id); };
    tryB('first');
    if (me.best >= 5) tryB('streak5');
    if (me.best >= 10) tryB('streak10');
    if (me.correct === Q.length) tryB('perfect');
    const hotsIdx = Q.map((q, i) => q.hots ? i : -1).filter(i => i >= 0);
    if (hotsIdx.length && hotsIdx.every(i => me.log[i] && me.log[i].ok)) tryB('hots');
    if (me.answered && avgT < 5 && acc >= 70) tryB('speed');
    if (myRank === 1 && me.worst > 5) tryB('comeback');
    if (myRank <= 3) confetti();

    const msg = myRank === 1 ? 'Juara 1! Pemahamanmu sudah kuat.' : (myRank <= 3 ? 'Masuk podium, sedikit lagi ke puncak.' : (acc >= 70 ? 'Pemahamanmu bagus; percepat lagi jawabanmu.' : 'Baca lagi bab yang ditandai di bawah, lalu coba lagi.'));
    draw(`
      <div class="kq-center">
        <div class="kq-verdict" style="font-size:2rem">Hasil akhir</div>
        ${podiumHtml(r)}
        <p class="kq-sub"><b>Peringkatmu: ${myRank} dari ${r.length}.</b> ${msg}</p>
        <div class="stats">
          <div><b>${idn(me.score)}</b><span>Skor total</span></div>
          <div><b>${me.correct}/${Q.length}</b><span>Jawaban benar (${acc}%)</span></div>
          <div><b>×${me.best}</b><span>Beruntun terbaik</span></div>
          <div><b>${me.answered ? avgT.toFixed(1).replace('.', ',') + ' dtk' : '-'}</b><span>Rata-rata waktu</span></div>
        </div>
        ${xpBoxHtml(rows, lvBefore)}
        ${earned.length ? `<div class="newb">${earned.map(id => `<span>${BADGE[id][1]} ${esc(BADGE[id][2])}</span>`).join('')}</div>` : ''}
        ${masteryHtml(me.log)}
        ${reviewHtml(me.log)}
        <div class="btnrow">
          <button class="kq-btn light" id="again" data-focus>Main lagi</button>
          <button class="kq-btn ghost" id="toHome">Menu kuis</button>
          <button class="kq-btn ghost" id="toSum">Kembali ke rangkuman</button>
        </div>
      </div>`, 'board', 'Hasil akhir');
    animateXpBox();
    bindMastery();
    on('#again', () => this.lobby());
    on('#toHome', () => Quiz.home());
    on('#toSum', () => showView('summary'));
  }
};

/* ----- Potongan tampilan hasil permainan ----- */
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
/* Penguasaan per topik soal; topik lemah diberi tautan ke bab (q.ref) */
function masteryHtml(log) {
  /* Kelompokkan per bab (q.ref) bila tersedia, agar saran "baca lagi" langsung menunjuk bab */
  const by = new Map();
  log.forEach(l => {
    const q = Q[l.i];
    const sec = q.ref && document.getElementById(q.ref);
    const k = sec ? 'ref:' + q.ref : 'topic:' + (q.topic || 'Umum');
    const label = sec ? plain(sec.dataset.toc || (sec.querySelector('h2') || {}).textContent || q.ref) : (q.topic || 'Umum');
    const o = by.get(k) || { n: 0, ok: 0, ref: sec ? q.ref : '', label };
    o.n++; if (l.ok) o.ok++;
    by.set(k, o);
  });
  if (by.size < 2) return '';
  const rows = [...by.values()].sort((a, b) => a.ok / a.n - b.ok / b.n);
  return `<div class="mastery" aria-label="Penguasaan per bab"><b style="text-align:center">Penguasaan per bab</b>${rows.map(o => {
    const pc = Math.round(o.ok / o.n * 100), weak = pc < 60;
    return `<div class="m ${weak ? 'weak' : ''}"><span>${esc(o.label)} <small style="opacity:.75">(${o.ok}/${o.n})</small>${weak && o.ref ? `<a href="#${esc(o.ref)}" data-goto="${esc(o.ref)}">Baca lagi bab ini</a>` : ''}</span><i><b style="width:${pc}%"></b></i><span>${pc}%</span></div>`;
  }).join('')}</div>`;
}
function bindMastery() {
  $$('[data-goto]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); goSection(a.dataset.goto); }));
}
function reviewHtml(log) {
  return `<div class="review">${log.map(l => {
    const q = Q[l.i];
    const t = l.timeout ? '<span class="tag t">Waktu habis</span>' : (l.ok ? '<span class="tag">Benar</span>' : '<span class="tag x">Salah</span>');
    return `<details><summary>${t}${q.hots ? '<span class="tag" style="background:#F5B301;color:#3a2a00">HOTS</span>' : ''}Soal ${l.i + 1}: ${rich(q.q)}</summary><p><b>Kunci: ${rich(q.o[q.a])}.</b>${l.ok || l.timeout || l.picked < 0 ? '' : ' Jawabanmu: ' + rich(q.o[l.picked]) + '.'} ${rich(q.e)}</p></details>`;
  }).join('')}</div>`;
}

/* =====================================================================
   15. Visual & motion: dipasang otomatis dari atribut data-*
   ===================================================================== */
const VIZ_COLORS = ['#46178F', '#1368CE', '#B98400', '#26890C', '#C4162F', '#00857C'];
/* Angka di atribut data-* ditulis gaya internasional (titik desimal, tanpa pemisah ribuan);
   tampilannya otomatis diubah ke format Indonesia oleh idn(). */
const vizNum = t => { const n = parseFloat(String(t).trim()); return isFinite(n) ? n : 0; };

/* Muncul saat digulir; juga memicu animasi grafik dan gambar */
let vizIO = null;
function watch(el, fn) {
  if (!('IntersectionObserver' in window)) { fn(el); return; }
  if (!vizIO) vizIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    vizIO.unobserve(e.target);
    (e.target.__vizFn || (x => x.classList.add('in')))(e.target);
  }), { rootMargin: '0px 0px -12% 0px', threshold: .15 });
  el.__vizFn = fn;
  vizIO.observe(el);
}

/* Angka berjalan: <b data-count="1234" data-suffix=" nm" data-dec="1"> */
function initCounters(root) {
  $$('[data-count]', root).forEach(el => {
    const to = vizNum(el.dataset.count), dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || '', pre = el.dataset.prefix || '';
    el.textContent = pre + idn(0, dec) + suf;
    watch(el, () => {
      if (reduceMotion()) { el.textContent = pre + idn(to, dec) + suf; return; }
      const t0 = performance.now(), dur = 1100;
      const tick = t => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = pre + idn(to * e, dec) + suf;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });
}

/* Grafik batang: <div class="viz" data-viz="bar" data-series="Sel batang:120;Sel kerucut:6" data-unit=" juta"> */
function initBars(el) {
  const rows = (el.dataset.series || '').split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.lastIndexOf(':');
    return { t: s.slice(0, i).trim(), v: vizNum(s.slice(i + 1)) };
  });
  if (!rows.length) return;
  const max = Math.max(...rows.map(r => r.v), 1), unit = el.dataset.unit || '', dec = +(el.dataset.dec || 0);
  const box = document.createElement('div'); box.className = 'bars';
  box.innerHTML = rows.map(r => `<div class="b"><span class="t">${esc(r.t)}</span><span class="track"><i data-w="${Math.max(1.5, r.v / max * 100)}"></i></span><span class="v">${idn(r.v, dec)}${esc(unit)}</span></div>`).join('');
  el.appendChild(box);
  watch(el, () => $$('.track i', box).forEach((i, k) => setTimeout(() => i.style.width = i.dataset.w + '%', reduceMotion() ? 0 : k * 90)));
}

/* Grafik garis: data-labels="2019,2020,2021" data-series="Akurasi:70,82,91;Waktu:40,30,22" */
function initLine(el) {
  const labels = (el.dataset.labels || '').split(',').map(s => s.trim()).filter(Boolean);
  const series = (el.dataset.series || '').split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.lastIndexOf(':');
    return { name: s.slice(0, i).trim(), vals: s.slice(i + 1).split(',').map(vizNum) };
  });
  if (!series.length) return;
  const W = 640, H = 300, L = 54, R = 16, T = series.length > 1 ? 34 : 14, B = 40;
  const all = series.flatMap(s => s.vals);
  const lo = el.dataset.min != null ? vizNum(el.dataset.min) : Math.min(0, ...all);
  const hi = el.dataset.max != null ? vizNum(el.dataset.max) : Math.max(...all) * 1.08 || 1;
  const n = Math.max(...series.map(s => s.vals.length));
  const x = i => L + (W - L - R) * (n > 1 ? i / (n - 1) : .5);
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const ticks = 4;
  let g = '';
  for (let k = 0; k <= ticks; k++) {
    const v = lo + (hi - lo) * k / ticks, yy = y(v);
    g += `<line class="grid" x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}"/><text class="lbl" x="${L - 8}" y="${yy + 4}" text-anchor="end">${esc(idn(v, +(el.dataset.dec || 0)))}</text>`;
  }
  labels.slice(0, n).forEach((t, i) => { g += `<text class="lbl" x="${x(i)}" y="${H - B + 22}" text-anchor="middle">${esc(t)}</text>`; });
  let paths = '', dots = '', lgd = '';
  series.forEach((s, k) => {
    const c = VIZ_COLORS[k % VIZ_COLORS.length];
    const d = s.vals.map((v, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(v)).join(' ');
    paths += `<path class="ln s${k}" d="${d}" stroke="${c}"/>`;
    dots += s.vals.map((v, i) => `<circle class="dot" cx="${x(i)}" cy="${y(v)}" fill="${c}"><title>${esc(s.name)}: ${esc(idn(v, 2))}</title></circle>`).join('');
    if (series.length > 1) lgd += `<g transform="translate(${L + k * 150} 16)"><rect width="14" height="4" y="-4" rx="2" fill="${c}"/><text class="lgd" x="20" y="0" fill="${c}">${esc(s.name)}</text></g>`;
  });
  const svg = document.createElement('div');
  svg.innerHTML = `<svg class="linechart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(el.dataset.alt || el.querySelector('.viz-title') && el.querySelector('.viz-title').textContent || 'Grafik garis')}">
    ${g}<line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/><line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>${lgd}${paths}${dots}</svg>`;
  const chart = svg.firstElementChild;
  el.appendChild(chart);
  $$('.ln', chart).forEach(p => { const len = Math.ceil(p.getTotalLength ? p.getTotalLength() : 1200); p.style.setProperty('--len', len); });
  watch(chart, c => c.classList.add('in'));
}

/* Gambar SVG yang menggambar dirinya: <svg data-draw> */
function initDraw(root) {
  $$('svg[data-draw]', root).forEach(svg => {
    $$('[stroke]', svg).forEach(p => {
      const len = p.getTotalLength ? Math.ceil(p.getTotalLength()) : 0;
      if (len) p.style.setProperty('--len', len);
    });
    watch(svg, s => s.classList.add('in'));
  });
}

/* Pemutar langkah: <div class="steps" data-steps><div class="step"><h5>…</h5><p>…</p></div>…</div>
   Setiap pergantian mengirim event "kq:step" berisi {index} agar lab bisa ikut bergerak. */
function initSteps(root) {
  $$('.steps[data-steps]', root).forEach(box => {
    const steps = $$('.step', box);
    if (!steps.length) return;
    const stage = document.createElement('div'); stage.className = 'stage';
    steps.forEach(s => stage.appendChild(s));
    const track = document.createElement('div'); track.className = 'track';
    track.innerHTML = steps.map(() => '<i><b></b></i>').join('');
    const bar = document.createElement('div'); bar.className = 'bar';
    bar.innerHTML = `<button type="button" class="play">Putar</button><button type="button" class="g prev">Sebelumnya</button><button type="button" class="g next">Berikutnya</button><span class="n"></span>`;
    box.append(track, stage, bar);
    const btn = { play: $('.play', bar), prev: $('.prev', bar), next: $('.next', bar), n: $('.n', bar) };
    let i = 0, timer = null;
    const show = k => {
      i = Math.max(0, Math.min(steps.length - 1, k));
      steps.forEach((s, j) => s.classList.toggle('on', j === i));
      $$('i', track).forEach((t, j) => t.classList.toggle('done', j <= i));
      btn.prev.disabled = i === 0; btn.next.disabled = i === steps.length - 1;
      btn.n.textContent = `Langkah ${i + 1} dari ${steps.length}`;
      box.dispatchEvent(new CustomEvent('kq:step', { detail: { index: i, total: steps.length }, bubbles: true }));
    };
    const stop = () => { clearInterval(timer); timer = null; btn.play.textContent = 'Putar'; };
    btn.play.addEventListener('click', () => {
      if (timer) return stop();
      if (i === steps.length - 1) show(0);
      btn.play.textContent = 'Jeda';
      timer = setInterval(() => { if (i >= steps.length - 1) return stop(); show(i + 1); }, 2600);
    });
    btn.prev.addEventListener('click', () => { stop(); show(i - 1); });
    btn.next.addEventListener('click', () => { stop(); show(i + 1); });
    show(0);
  });
}

/* Penggeser banding: lapisan .lay.a menempati sisi kanan (dasar), .lay.b ditampilkan di sisi kiri.
   <div class="compare" data-left="Sebelum" data-right="Sesudah"><div class="lay a">sesudah</div><div class="lay b">sebelum</div></div> */
function initCompare(root) {
  $$('.compare', root).forEach(box => {
    if ($('.hnd', box)) return;
    const hnd = document.createElement('div'); hnd.className = 'hnd';
    const rng = document.createElement('input');
    rng.type = 'range'; rng.min = 0; rng.max = 100; rng.value = 50;
    rng.setAttribute('aria-label', 'Geser untuk membandingkan ' + (box.dataset.left || 'kiri') + ' dan ' + (box.dataset.right || 'kanan'));
    const l = document.createElement('span'); l.className = 'tagl'; l.textContent = box.dataset.left || '';
    const r = document.createElement('span'); r.className = 'tagr'; r.textContent = box.dataset.right || '';
    box.append(hnd, rng, l, r);
    const b = $('.lay.b', box);
    const set = v => { hnd.style.left = v + '%'; if (b) b.style.clipPath = `inset(0 ${100 - v}% 0 0)`; };
    rng.addEventListener('input', () => set(+rng.value));
    set(50);
  });
}

/* Penanda titik: <figure class="figure hotspots"><svg…/><button class="hs" style="left:32%;top:48%" data-tip="Penjelasan">1</button></figure> */
function initHotspots(root) {
  $$('.hotspots', root).forEach(box => {
    const spots = $$('.hs', box);
    if (!spots.length) return;
    let tip = $('.tip', box);
    if (!tip) { tip = document.createElement('p'); tip.className = 'tip'; tip.setAttribute('aria-live', 'polite'); box.appendChild(tip); }
    tip.textContent = box.dataset.hint || 'Ketuk nomor pada gambar untuk melihat keterangannya.';
    spots.forEach((s, i) => {
      if (!s.textContent.trim()) s.textContent = i + 1;
      s.type = 'button'; s.setAttribute('aria-expanded', 'false');
      s.addEventListener('click', () => {
        const open = s.getAttribute('aria-expanded') === 'true';
        spots.forEach(o => o.setAttribute('aria-expanded', 'false'));
        s.setAttribute('aria-expanded', String(!open));
        tip.textContent = open ? (box.dataset.hint || 'Ketuk nomor pada gambar untuk melihat keterangannya.') : (s.dataset.tip || '');
      });
    });
  });
}

/* =====================================================================
   15b. Grafik analisis: sebar, lingkaran, batang bertumpuk, histogram
   ===================================================================== */
const parsePairs = s => s.split(';').map(t => t.trim()).filter(Boolean).map(t => {
  const [a, b] = t.split(',');
  return { x: vizNum(a), y: vizNum(b) };
});
const splitSeries = s => (s || '').split('|').map(t => t.trim()).filter(Boolean).map(t => {
  const i = t.indexOf(':');
  return { name: t.slice(0, i).trim(), body: t.slice(i + 1) };
});
function axisFrame(W, H, L, R, T, B, xlo, xhi, ylo, yhi, xlab, ylab, dec) {
  let g = '';
  const X = v => L + (W - L - R) * ((v - xlo) / (xhi - xlo || 1));
  const Y = v => T + (H - T - B) * (1 - (v - ylo) / (yhi - ylo || 1));
  for (let k = 0; k <= 4; k++) {
    const v = ylo + (yhi - ylo) * k / 4, y = Y(v);
    g += `<line class="grid" x1="${L}" y1="${y}" x2="${W - R}" y2="${y}"/><text class="lbl" x="${L - 8}" y="${y + 4}" text-anchor="end">${esc(idn(v, dec))}</text>`;
  }
  for (let k = 0; k <= 4; k++) {
    const v = xlo + (xhi - xlo) * k / 4, x = X(v);
    g += `<text class="lbl" x="${x}" y="${H - B + 22}" text-anchor="middle">${esc(idn(v, dec))}</text>`;
  }
  g += `<line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/><line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>`;
  if (xlab) g += `<text class="lbl" x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">${esc(xlab)}</text>`;
  if (ylab) g += `<text class="lbl" transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(ylab)}</text>`;
  return { g, X, Y };
}

/* Diagram sebar: data-series="Kelas A: 1,2 ; 2,3 | Kelas B: 1,5 ; 2,1"  data-trend="1" */
function initScatter(el) {
  const series = splitSeries(el.dataset.series).map(s => ({ name: s.name, pts: parsePairs(s.body) })).filter(s => s.pts.length);
  if (!series.length) return;
  const all = series.flatMap(s => s.pts);
  const pad = (a, b) => { const d = (b - a) || 1; return [a - d * .08, b + d * .08]; };
  const [xlo, xhi] = pad(Math.min(...all.map(p => p.x)), Math.max(...all.map(p => p.x)));
  const [ylo, yhi] = pad(Math.min(...all.map(p => p.y)), Math.max(...all.map(p => p.y)));
  const W = 640, H = 340, L = 60, R = 18, T = series.length > 1 ? 34 : 16, B = 48;
  const dec = +(el.dataset.dec || 0);
  const f = axisFrame(W, H, L, R, T, B, xlo, xhi, ylo, yhi, el.dataset.xlabel, el.dataset.ylabel, dec);
  let body = f.g, lgd = '', info = '';
  series.forEach((s, k) => {
    const c = VIZ_COLORS[k % VIZ_COLORS.length];
    body += s.pts.map(p => `<circle class="dot" cx="${f.X(p.x)}" cy="${f.Y(p.y)}" r="5" fill="${c}" fill-opacity=".85"><title>${esc(s.name)}: ${esc(idn(p.x, 2))}, ${esc(idn(p.y, 2))}</title></circle>`).join('');
    if (series.length > 1) lgd += `<g transform="translate(${L + k * 160} 16)"><circle cx="6" cy="-4" r="5" fill="${c}"/><text class="lgd" x="18" y="0" fill="${c}">${esc(s.name)}</text></g>`;
    if (el.dataset.trend != null && s.pts.length > 1) {
      const n = s.pts.length, sx = s.pts.reduce((a, p) => a + p.x, 0), sy = s.pts.reduce((a, p) => a + p.y, 0);
      const sxy = s.pts.reduce((a, p) => a + p.x * p.y, 0), sxx = s.pts.reduce((a, p) => a + p.x * p.x, 0);
      const syy = s.pts.reduce((a, p) => a + p.y * p.y, 0);
      const m = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1), b0 = (sy - m * sx) / n;
      const r = (n * sxy - sx * sy) / (Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy)) || 1);
      body += `<path class="ln" d="M${f.X(xlo)} ${f.Y(m * xlo + b0)} L${f.X(xhi)} ${f.Y(m * xhi + b0)}" stroke="${c}" stroke-dasharray="8 6" stroke-width="2.5" opacity=".9"/>`;
      info += `<div><b style="color:${c}">${esc(s.name)}</b> y = ${idn(m, 3)}x ${b0 < 0 ? '−' : '+'} ${idn(Math.abs(b0), 3)}, r = ${idn(r, 3)}, r² = ${idn(r * r, 3)}</div>`;
    }
  });
  const box = document.createElement('div');
  box.innerHTML = `<svg class="linechart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(el.dataset.alt || 'Diagram sebar')}">${body}${lgd}</svg>${info ? `<div class="viz-stat">${info}</div>` : ''}`;
  while (box.firstChild) el.appendChild(box.firstChild);
  watch($('.linechart', el), c => c.classList.add('in'));
}

/* Lingkaran / donat: data-viz="pie" atau "donut", data-series="Label:40;Label:35" */
function initPie(el) {
  const rows = (el.dataset.series || '').split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.lastIndexOf(':');
    return { t: s.slice(0, i).trim(), v: Math.max(0, vizNum(s.slice(i + 1))) };
  }).filter(r => r.v > 0);
  if (!rows.length) return;
  const tot = rows.reduce((a, r) => a + r.v, 0), donut = el.dataset.viz === 'donut';
  const R = 78, C = 100, hole = donut ? 44 : 0;
  let a0 = -Math.PI / 2, paths = '';
  rows.forEach((r, k) => {
    const a1 = a0 + r.v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (ang, rad) => [C + Math.cos(ang) * rad, C + Math.sin(ang) * rad];
    const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, hole), [x3, y3] = p(a0, hole);
    const d = hole
      ? `M${x0} ${y0} A${R} ${R} 0 ${big} 1 ${x1} ${y1} L${x2} ${y2} A${hole} ${hole} 0 ${big} 0 ${x3} ${y3} Z`
      : `M${C} ${C} L${x0} ${y0} A${R} ${R} 0 ${big} 1 ${x1} ${y1} Z`;
    paths += `<path class="sl" d="${d}" fill="${VIZ_COLORS[k % VIZ_COLORS.length]}" style="--d:${k * 90}ms"><title>${esc(r.t)}: ${esc(idn(r.v, 2))} (${idn(r.v / tot * 100, 1)}%)</title></path>`;
    a0 = a1;
  });
  const mid = donut ? `<text class="pie-mid" x="${C}" y="${C - 2}" text-anchor="middle">${esc(el.dataset.center || idn(tot, +(el.dataset.dec || 0)))}</text><text class="pie-sub" x="${C}" y="${C + 16}" text-anchor="middle">${esc(el.dataset.centerSub || 'total')}</text>` : '';
  const box = document.createElement('div');
  box.className = 'pie-wrap';
  box.innerHTML = `<svg class="pie" viewBox="0 0 200 200" role="img" aria-label="${esc(el.dataset.alt || 'Diagram lingkaran')}">${paths}${mid}</svg>
    <div class="pie-lgd">${rows.map((r, k) => `<div><i style="background:${VIZ_COLORS[k % VIZ_COLORS.length]}"></i><span>${esc(r.t)}</span><b>${idn(r.v / tot * 100, 1)}%</b></div>`).join('')}</div>`;
  el.appendChild(box);
  watch(box, b => b.classList.add('in'));
}

/* Batang bertumpuk: data-labels="2023,2024", data-series="Lulus:20,24;Mengulang:5,3" */
function initStacked(el) {
  const labels = (el.dataset.labels || '').split(',').map(s => s.trim()).filter(Boolean);
  const series = (el.dataset.series || '').split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.lastIndexOf(':');
    return { name: s.slice(0, i).trim(), vals: s.slice(i + 1).split(',').map(vizNum) };
  });
  if (!series.length || !labels.length) return;
  const pct = el.dataset.mode === 'persen';
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.vals[i] || 0), 0));
  const max = pct ? 100 : Math.max(...totals, 1);
  const W = 640, H = 320, L = 54, R = 16, T = 34, B = 44;
  const bw = Math.min(70, (W - L - R) / labels.length * .6);
  let g = '', lgd = '';
  for (let k = 0; k <= 4; k++) {
    const v = max * k / 4, y = T + (H - T - B) * (1 - k / 4);
    g += `<line class="grid" x1="${L}" y1="${y}" x2="${W - R}" y2="${y}"/><text class="lbl" x="${L - 8}" y="${y + 4}" text-anchor="end">${esc(idn(v, 0))}${pct ? '%' : ''}</text>`;
  }
  labels.forEach((lab, i) => {
    const cx = L + (W - L - R) * ((i + .5) / labels.length);
    let acc = 0;
    series.forEach((s, k) => {
      const raw = s.vals[i] || 0, v = pct ? (totals[i] ? raw / totals[i] * 100 : 0) : raw;
      const h = (H - T - B) * (v / max), y = T + (H - T - B) * (1 - (acc + v) / max);
      g += `<rect class="stk" x="${cx - bw / 2}" y="${y}" width="${bw}" height="${h}" fill="${VIZ_COLORS[k % VIZ_COLORS.length]}" rx="3" style="--h:${h};--y:${y}"><title>${esc(s.name)} ${esc(lab)}: ${esc(idn(raw, 2))}</title></rect>`;
      acc += v;
    });
    g += `<text class="lbl" x="${cx}" y="${H - B + 22}" text-anchor="middle">${esc(lab)}</text>`;
  });
  series.forEach((s, k) => { lgd += `<g transform="translate(${L + k * 150} 16)"><rect width="12" height="12" y="-10" rx="3" fill="${VIZ_COLORS[k % VIZ_COLORS.length]}"/><text class="lgd" x="18" y="0" fill="${VIZ_COLORS[k % VIZ_COLORS.length]}">${esc(s.name)}</text></g>`; });
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg class="linechart stacked" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(el.dataset.alt || 'Batang bertumpuk')}"><line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/><line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>${g}${lgd}</svg>`;
  el.appendChild(wrap.firstChild);
  watch($('.stacked', el), c => c.classList.add('in'));
}

/* Histogram: data-values="2.3,4.1,…" data-bins="8" */
function initHist(el) {
  const vals = (el.dataset.values || '').split(',').map(vizNum).filter(v => isFinite(v));
  if (vals.length < 2) return;
  const bins = Math.max(3, Math.min(20, +(el.dataset.bins || 8)));
  const lo = Math.min(...vals), hi = Math.max(...vals), step = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  vals.forEach(v => counts[Math.min(bins - 1, Math.floor((v - lo) / step))]++);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  const sorted = [...vals].sort((a, b) => a - b);
  const med = vals.length % 2 ? sorted[(vals.length - 1) / 2] : (sorted[vals.length / 2 - 1] + sorted[vals.length / 2]) / 2;
  const W = 640, H = 300, L = 54, R = 16, T = 16, B = 44, max = Math.max(...counts);
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = max * k / 4, y = T + (H - T - B) * (1 - k / 4);
    g += `<line class="grid" x1="${L}" y1="${y}" x2="${W - R}" y2="${y}"/><text class="lbl" x="${L - 8}" y="${y + 4}" text-anchor="end">${idn(v, 0)}</text>`;
  }
  const bw = (W - L - R) / bins;
  counts.forEach((c, i) => {
    const h = (H - T - B) * (c / (max || 1)), y = T + (H - T - B) - h;
    g += `<rect class="stk" x="${L + i * bw + 2}" y="${y}" width="${bw - 4}" height="${h}" rx="3" fill="${VIZ_COLORS[0]}" style="--h:${h};--y:${y}"><title>${idn(lo + i * step, 2)} sampai ${idn(lo + (i + 1) * step, 2)}: ${c} data</title></rect>`;
  });
  [0, bins / 2, bins].forEach(i => { g += `<text class="lbl" x="${L + i * bw}" y="${H - B + 22}" text-anchor="middle">${esc(idn(lo + i * step, +(el.dataset.dec || 1)))}</text>`; });
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg class="linechart stacked" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(el.dataset.alt || 'Histogram')}">${g}<line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/><line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/></svg>
    <div class="viz-stat"><div>n = ${vals.length}, rata-rata = ${idn(mean, 2)}, median = ${idn(med, 2)}, simpangan baku = ${idn(sd, 2)}, rentang ${idn(lo, 2)} sampai ${idn(hi, 2)}</div></div>`;
  while (wrap.firstChild) el.appendChild(wrap.firstChild);
  watch($('.stacked', el), c => c.classList.add('in'));
}

/* =====================================================================
   15c. Tabel data gaya lembar kerja: urut, saring, kolom rumus, total, CSV
   ===================================================================== */
function initTables(root) {
  $$('[data-table]', root).forEach(box => {
    const table = $('table', box);
    if (!table || box.dataset.tableReady) return;
    box.dataset.tableReady = '1';
    box.classList.add('dtable');
    const ths = $$('thead th', table);
    const names = ths.map(t => (t.dataset.key || t.textContent).trim());
    const numCol = ths.map(t => t.hasAttribute('data-num') || t.hasAttribute('data-formula'));
    const dec = ths.map(t => +(t.dataset.dec || 0));
    const formula = ths.map(t => t.dataset.formula || '');
    const rows = () => $$('tbody tr', table);

    /* rumus kolom: ditulis dengan nama kolom, misal data-formula="Nilai*Bobot/100" */
    const compiled = formula.map(f => {
      if (!f) return null;
      let expr = f;
      names.forEach((n, i) => { if (n) expr = expr.split(n).join('c[' + i + ']'); });
      const probe = expr.replace(/c\[\d+\]/g, '0').replace(/Math\.[A-Za-z0-9_]+/g, '0');
      if (!/^[0-9+\-*/%().,\s<>=?:!]*$/.test(probe)) {
        console.warn('[KuisKelas] rumus tabel ditolak:', f); return null;
      }
      try { return new Function('c', 'return (' + expr + ')'); } catch (e) { return null; }
    });
    /* nilai sel: dataset.raw sudah berupa angka mentah; teks ditulis format Indonesia */
    const cellNum = td => td.dataset.raw != null
      ? vizNum(td.dataset.raw)
      : vizNum(String(td.textContent).trim().replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    const recompute = () => {
      rows().forEach(tr => {
        const tds = $$('td', tr);
        const c = tds.map((td, i) => numCol[i] ? cellNum(td) : td.textContent.trim());
        compiled.forEach((fn, i) => {
          if (!fn || !tds[i]) return;
          let v = 0; try { v = fn(c); } catch (e) { v = 0; }
          c[i] = v; tds[i].dataset.raw = v; tds[i].textContent = idn(v, dec[i]);
        });
      });
      foot();
    };
    /* baris ringkasan */
    const sums = ths.map(t => t.dataset.sum || '');
    let tfoot = $('tfoot', table);
    const foot = () => {
      if (!sums.some(Boolean)) return;
      if (!tfoot) { tfoot = document.createElement('tfoot'); tfoot.innerHTML = '<tr>' + ths.map(() => '<td></td>').join('') + '</tr>'; table.appendChild(tfoot); }
      const tds = $$('td', tfoot);
      const visible = rows().filter(tr => !tr.hidden);
      sums.forEach((kind, i) => {
        if (!kind) { if (i === 0) tds[0].textContent = visible.length + ' baris'; return; }
        const vals = visible.map(tr => cellNum($$('td', tr)[i])).filter(v => isFinite(v));
        const tot = vals.reduce((a, b) => a + b, 0);
        const v = kind === 'rata' ? (vals.length ? tot / vals.length : 0) : kind === 'maks' ? Math.max(...vals, 0) : kind === 'min' ? Math.min(...vals, 0) : tot;
        const lbl = { rata: 'rata-rata', maks: 'maks', min: 'min', jumlah: 'jumlah' }[kind] || kind;
        tds[i].innerHTML = `<small>${esc(lbl)}</small>${idn(v, dec[i])}`;
      });
    };
    /* urutkan */
    ths.forEach((th, i) => {
      th.tabIndex = 0; th.setAttribute('role', 'button'); th.classList.add('srt');
      const go = () => {
        const asc = th.dataset.dir !== 'asc';
        ths.forEach(o => { if (o !== th) delete o.dataset.dir; });
        th.dataset.dir = asc ? 'asc' : 'desc';
        const body = $('tbody', table);
        rows().slice().sort((a, b) => {
          const x = $$('td', a)[i], y = $$('td', b)[i];
          const r = numCol[i] ? cellNum(x) - cellNum(y) : x.textContent.localeCompare(y.textContent, 'id');
          return asc ? r : -r;
        }).forEach(tr => body.appendChild(tr));
      };
      th.addEventListener('click', go);
      th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    /* sel yang bisa diubah */
    ths.forEach((th, i) => {
      if (!th.hasAttribute('data-edit')) return;
      th.classList.add('edt');
      rows().forEach(tr => {
        const td = $$('td', tr)[i]; if (!td) return;
        td.contentEditable = 'true'; td.className = 'edit'; td.inputMode = 'decimal';
        td.addEventListener('blur', () => { const v = cellNum(td); td.dataset.raw = v; td.textContent = idn(v, dec[i]); recompute(); });
        td.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); td.blur(); } });
      });
    });
    /* alat: cari dan unduh */
    if (!table.parentElement.classList.contains('dt-wrap')) {
      const wrap = document.createElement('div'); wrap.className = 'dt-wrap';
      table.parentNode.insertBefore(wrap, table); wrap.appendChild(table);
    }
    const bar = document.createElement('div'); bar.className = 'dt-bar';
    const editable = ths.some(t => t.hasAttribute('data-edit'));
    bar.innerHTML = `${box.dataset.filter != null ? '<input type="search" class="dt-find" placeholder="Cari di tabel…" aria-label="Cari di tabel">' : ''}
      <span class="dt-hint">${editable ? 'Sel bertanda dapat diubah, kolom rumus ikut menghitung ulang.' : 'Klik judul kolom untuk mengurutkan.'}</span>
      ${box.dataset.export != null ? '<button type="button" class="dt-csv">Unduh CSV</button>' : ''}`;
    box.insertBefore(bar, box.firstChild);
    const find = $('.dt-find', bar);
    if (find) find.addEventListener('input', () => {
      const q = find.value.toLowerCase().trim();
      rows().forEach(tr => tr.hidden = q && !tr.textContent.toLowerCase().includes(q));
      foot();
    });
    const csv = $('.dt-csv', bar);
    if (csv) csv.addEventListener('click', () => {
      const data = [names].concat(rows().filter(tr => !tr.hidden).map(tr => $$('td', tr).map(td => (td.dataset.raw != null ? td.dataset.raw : td.textContent).trim())));
      csvDownload((box.dataset.export || 'tabel') + (/\.csv$/i.test(box.dataset.export || '') ? '' : '.csv'), data);
    });
    numCol.forEach((n, i) => { if (n) rows().forEach(tr => { const td = $$('td', tr)[i]; if (td) td.classList.add('num'); }); });
    recompute();
  });
}

/* =====================================================================
   15d. Peragaan 3D
   Perender lunak di atas <canvas> 2D: tanpa pustaka luar, jalan luring.
   Alur yang diperagakan sama dengan pipa grafika: model → dunia → kamera →
   proyeksi → layar, dengan pengurutan pelukis dan pencahayaan Lambert.
   ===================================================================== */
const MESH = {
  kubus() {
    const v = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    const f = [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[4,5,1,0],[3,2,6,7]];
    return { v, f };
  },
  limas() {
    const v = [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[0,1.4,0]];
    const f = [[3,2,1,0],[0,1,4],[1,2,4],[2,3,4],[3,0,4]];
    return { v, f };
  },
  prisma() {
    const v = [[-1,-1,-1],[1,-1,-1],[0,1,-1],[-1,-1,1],[1,-1,1],[0,1,1]];
    const f = [[2,1,0],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]];
    return { v, f };
  },
  bola(seg = 16, ring = 10) {
    const v = [], f = [];
    for (let i = 0; i <= ring; i++) {
      const th = i / ring * Math.PI;
      for (let j = 0; j < seg; j++) {
        const ph = j / seg * Math.PI * 2;
        v.push([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]);
      }
    }
    for (let i = 0; i < ring; i++) for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + (j + 1) % seg;
      f.push([a, b, b + seg, a + seg]);
    }
    return { v, f };
  },
  silinder(seg = 18) {
    const v = [], f = [];
    for (let j = 0; j < seg; j++) {
      const a = j / seg * Math.PI * 2;
      v.push([Math.cos(a), -1, Math.sin(a)]); v.push([Math.cos(a), 1, Math.sin(a)]);
    }
    for (let j = 0; j < seg; j++) {
      const a = j * 2, b = ((j + 1) % seg) * 2;
      f.push([a, b, b + 1, a + 1]);
    }
    f.push(Array.from({ length: seg }, (_, j) => j * 2).reverse());
    f.push(Array.from({ length: seg }, (_, j) => j * 2 + 1));
    return { v, f };
  },
  torus(seg = 20, ring = 12, r = .42) {
    const v = [], f = [];
    for (let i = 0; i < ring; i++) for (let j = 0; j < seg; j++) {
      const u = i / ring * Math.PI * 2, t = j / seg * Math.PI * 2;
      v.push([(1 + r * Math.cos(t)) * Math.cos(u), r * Math.sin(t), (1 + r * Math.cos(t)) * Math.sin(u)]);
    }
    for (let i = 0; i < ring; i++) for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + (j + 1) % seg, c = ((i + 1) % ring) * seg + (j + 1) % seg, d = ((i + 1) % ring) * seg + j;
      f.push([a, b, c, d]);
    }
    return { v, f };
  }
};

function scene3d(canvas, opts) {
  opts = opts || {};
  const S = {
    mesh: typeof opts.mesh === 'string' ? (MESH[opts.mesh] || MESH.kubus)() : (opts.mesh || MESH.kubus()),
    rot: { x: -.5, y: .7, z: 0 }, scale: { x: 1, y: 1, z: 1 }, pos: { x: 0, y: 0, z: 0 },
    dist: 5.2, fov: 55, persp: opts.persp !== false, shade: opts.shade || 'flat',
    spin: !!opts.spin, color: opts.color || '#7B4BD8', bg: opts.bg || null, onFrame: opts.onFrame || null
  };
  const ctx = canvas.getContext('2d');
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  const mul = (a, b) => a.map((_, i) => b[0].map((_, j) => a[i].reduce((s, v, k) => s + v * b[k][j], 0)));
  const rotM = (x, y, z) => {
    const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    return mul(mul([[1,0,0],[0,cx,-sx],[0,sx,cx]], [[cy,0,sy],[0,1,0],[-sy,0,cy]]), [[cz,-sz,0],[sz,cz,0],[0,0,1]]);
  };
  S.matrix = () => {
    const R = rotM(S.rot.x, S.rot.y, S.rot.z);
    return R.map((row, i) => row.map((v, j) => v * [S.scale.x, S.scale.y, S.scale.z][j]));
  };

  function draw() {
    const w = canvas.width, h = canvas.height, M = S.matrix();
    ctx.clearRect(0, 0, w, h);
    if (S.bg) { ctx.fillStyle = S.bg; ctx.fillRect(0, 0, w, h); }
    const k = Math.min(w, h) / 2 / Math.tan(S.fov * Math.PI / 360);
    const P = S.mesh.v.map(p => {
      const x = M[0][0]*p[0] + M[0][1]*p[1] + M[0][2]*p[2] + S.pos.x;
      const y = M[1][0]*p[0] + M[1][1]*p[1] + M[1][2]*p[2] + S.pos.y;
      const z = M[2][0]*p[0] + M[2][1]*p[1] + M[2][2]*p[2] + S.pos.z + S.dist;
      const f = S.persp ? k / Math.max(.15, z) : Math.min(w, h) / 4.4;
      return { x: w / 2 + x * f, y: h / 2 - y * f, z, ok: z > .15 };
    });
    const faces = S.mesh.f.map(idx => {
      const pts = idx.map(i => P[i]);
      const zc = pts.reduce((a, p) => a + p.z, 0) / pts.length;
      const a = S.mesh.v[idx[0]], b = S.mesh.v[idx[1]], c = S.mesh.v[idx[2]];
      const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
      let n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      const nn = [0,1,2].map(i => M[i][0]*n[0] + M[i][1]*n[1] + M[i][2]*n[2]);
      const len = Math.hypot(...nn) || 1;
      return { pts, zc, n: nn.map(q => q / len), ok: pts.every(p => p.ok) };
    }).filter(f => f.ok).sort((a, b) => b.zc - a.zc);

    const ink = cssVar('--ink') || '#161A3C';
    const L = [-.45, .6, .66];
    faces.forEach(f => {
      const back = f.n[2] > 0;
      if (S.shade !== 'rangka' && back) return;            // buang muka belakang
      ctx.beginPath();
      f.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath();
      if (S.shade === 'rangka') {
        ctx.strokeStyle = back ? 'rgba(123,75,216,.28)' : S.color;
        ctx.lineWidth = back ? 1 : 1.8; ctx.stroke();
        return;
      }
      const lam = Math.max(0, -(f.n[0]*L[0] + f.n[1]*L[1] + f.n[2]*L[2]));
      const t = .28 + .72 * lam;
      const c = S.color.match(/\w\w/g).map(x => parseInt(x, 16));
      ctx.fillStyle = `rgb(${c.map(v => Math.round(255 - (255 - v) * t)).join(',')})`;
      ctx.fill();
      if (S.shade === 'flat') { ctx.strokeStyle = 'rgba(22,26,60,.25)'; ctx.lineWidth = 1; ctx.stroke(); }
    });
    if (S.axes !== false) {                                 // sumbu koordinat
      const O = { x: w / 2, y: h / 2 };
      [['#C4162F', [1.9,0,0]], ['#26890C', [0,1.9,0]], ['#1368CE', [0,0,1.9]]].forEach(([col, a]) => {
        const x = M[0][0]*a[0] + M[0][1]*a[1] + M[0][2]*a[2];
        const y = M[1][0]*a[0] + M[1][1]*a[1] + M[1][2]*a[2];
        const z = M[2][0]*a[0] + M[2][1]*a[1] + M[2][2]*a[2] + S.dist;
        const f = S.persp ? k / Math.max(.15, z) : Math.min(w, h) / 4.4;
        ctx.beginPath(); ctx.moveTo(O.x, O.y); ctx.lineTo(w / 2 + x * f, h / 2 - y * f);
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = .75; ctx.stroke(); ctx.globalAlpha = 1;
      });
    }
    if (S.onFrame) S.onFrame(S, ctx);
  }

  /* interaksi: seret untuk memutar, cubit/gulir untuk mendekat */
  let drag = null;
  const pt = e => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
  const down = e => { drag = pt(e); S.spin = false; canvas.setPointerCapture && e.pointerId != null && canvas.setPointerCapture(e.pointerId); };
  const move = e => {
    if (!drag) return;
    const p = pt(e);
    S.rot.y += (p.x - drag.x) * .01; S.rot.x += (p.y - drag.y) * .01;
    drag = p; e.preventDefault(); draw();
    if (S.onInput) S.onInput(S);
  };
  const up = () => { drag = null; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); S.dist = Math.min(14, Math.max(2.4, S.dist + Math.sign(e.deltaY) * .35)); draw(); }, { passive: false });
  canvas.style.touchAction = 'none';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.addEventListener('keydown', e => {
    const k = { ArrowLeft: ['y', -.12], ArrowRight: ['y', .12], ArrowUp: ['x', -.12], ArrowDown: ['x', .12] }[e.key];
    if (!k) return;
    e.preventDefault(); S.spin = false; S.rot[k[0]] += k[1]; draw();
  });

  let raf = null;
  const loop = () => { if (S.spin && !reduceMotion()) { S.rot.y += .012; draw(); } raf = requestAnimationFrame(loop); };
  S.draw = draw; S.setMesh = m => { S.mesh = typeof m === 'string' ? (MESH[m] || MESH.kubus)() : m; draw(); };
  S.stop = () => cancelAnimationFrame(raf);
  draw(); loop();
  return S;
}

/* Deklaratif: <div class="kq3d" data-3d="kubus" data-3d-controls="bentuk,proyeksi,tampilan,putar,skala" data-3d-matrix> */
function init3D(root) {
  $$('[data-3d]', root).forEach(box => {
    if (box.dataset.ready3d) return;
    box.dataset.ready3d = '1';
    box.classList.add('kq3d');
    const cv = document.createElement('canvas');
    cv.className = 'kq-canvas'; cv.width = 640; cv.height = 400;
    cv.setAttribute('aria-label', box.dataset.alt || 'Peragaan tiga dimensi, seret untuk memutar');
    box.appendChild(cv);
    const S = scene3d(cv, { mesh: box.dataset['3d'] || 'kubus', spin: box.dataset.spin != null, shade: box.dataset.shade || 'flat' });
    const ctrls = (box.dataset['3dControls'] || 'bentuk,proyeksi,tampilan,putar').split(',').map(s => s.trim()).filter(Boolean);
    const bar = document.createElement('div'); bar.className = 'kq3d-bar';
    const parts = [];
    if (ctrls.includes('bentuk')) parts.push(`<label>Bentuk<select data-c="bentuk">${Object.keys(MESH).map(m => `<option value="${m}"${m === (box.dataset['3d'] || 'kubus') ? ' selected' : ''}>${m[0].toUpperCase() + m.slice(1)}</option>`).join('')}</select></label>`);
    if (ctrls.includes('proyeksi')) parts.push(`<label>Proyeksi<select data-c="proyeksi"><option value="1">Perspektif</option><option value="0">Ortografis</option></select></label>`);
    if (ctrls.includes('tampilan')) parts.push(`<label>Tampilan<select data-c="tampilan"><option value="flat">Bidang berbayang</option><option value="halus">Tanpa garis</option><option value="rangka">Rangka kawat</option></select></label>`);
    if (ctrls.includes('skala')) parts.push(`<label>Skala Y<input type="range" data-c="sy" min="0.3" max="2" step="0.05" value="1"></label>`);
    if (ctrls.includes('fov')) parts.push(`<label>Sudut pandang<input type="range" data-c="fov" min="20" max="100" step="1" value="55"></label>`);
    if (ctrls.includes('putar')) parts.push(`<button type="button" data-c="spin">${S.spin ? 'Hentikan putaran' : 'Putar otomatis'}</button>`);
    bar.innerHTML = parts.join('');
    if (parts.length) box.appendChild(bar);
    let mat = null;
    if (box.dataset['3dMatrix'] != null) {
      mat = document.createElement('div'); mat.className = 'kq3d-mat';
      box.appendChild(mat);
      const paint = () => {
        const M = S.matrix();
        mat.innerHTML = '<b>Matriks transformasi (rotasi × skala)</b><div class="m">' +
          M.map(r => r.map(v => `<span>${v.toFixed(2).replace('.', ',')}</span>`).join('')).join('') + '</div>';
      };
      S.onInput = paint; paint();
      const old = S.draw; S.draw = () => { old(); paint(); };
    }
    $$('[data-c]', bar).forEach(c => {
      const ev = c.tagName === 'BUTTON' ? 'click' : (c.tagName === 'SELECT' ? 'change' : 'input');
      c.addEventListener(ev, () => {
        const k = c.dataset.c;
        if (k === 'bentuk') S.setMesh(c.value);
        if (k === 'proyeksi') S.persp = c.value === '1';
        if (k === 'tampilan') S.shade = c.value;
        if (k === 'sy') S.scale.y = +c.value;
        if (k === 'fov') S.fov = +c.value;
        if (k === 'spin') { S.spin = !S.spin; c.textContent = S.spin ? 'Hentikan putaran' : 'Putar otomatis'; }
        S.draw();
      });
    });
  });
}

function initViz(root) {
  root = root || document;
  initCounters(root);
  $$('[data-viz="bar"]', root).forEach(initBars);
  $$('[data-viz="line"]', root).forEach(initLine);
  $$('[data-viz="scatter"]', root).forEach(initScatter);
  $$('[data-viz="pie"],[data-viz="donut"]', root).forEach(initPie);
  $$('[data-viz="stacked"]', root).forEach(initStacked);
  $$('[data-viz="hist"]', root).forEach(initHist);
  initTables(root); init3D(root);
  initDraw(root); initSteps(root); initCompare(root); initHotspots(root);
  $$('[data-reveal]', root).forEach(el => watch(el, e => e.classList.add('in')));
}

/* =====================================================================
   16. Keyboard, inisialisasi, API publik
   ===================================================================== */
document.addEventListener('keydown', e => {
  if (!KEYPICK || $('#view-quiz').hidden) return;
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  const idx = ['1', '2', '3', '4'].indexOf(k) >= 0 ? +k - 1 : ['a', 'b', 'c', 'd'].indexOf(k);
  if (idx >= 0) { e.preventDefault(); KEYPICK(idx); }
});

function init() {
  if (!$('#view-summary')) console.warn('[KuisKelas] <main id="view-summary"> tidak ditemukan.');
  buildShell();
  validate();
  enhanceSummary();
  initViz();
  dailyCheckIn();
  if (location.hash === '#quiz') showView('quiz');
}

window.KQ = {
  version: VERSION,
  online: () => false,
  /* KQ.award('nama-unik', 25, 'Label') untuk interaksi khusus materi; sekali per kunci */
  award: (key, amount, label) => award(key ? MID + ':x:' + key : null, Math.min(100, amount || 0), label),
  profile: () => JSON.parse(JSON.stringify(P)),
  toast, confetti, showView, goSection,
  /* Pasang ulang komponen visual pada elemen yang baru dibuat lab */
  viz: el => initViz(el || document),
  /* Peragaan 3D untuk lab khusus: KQ.scene3d(canvas, {mesh:'bola'|{v,f}, spin:true}) */
  scene3d, meshes: MESH
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
