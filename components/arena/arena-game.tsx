'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Crown, Flame, Loader2, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExplanationLocked } from '@/components/subscription/explanation-locked';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage, fmtNum } from '@/lib/labels';
import { rich } from '@/lib/rich';
import { cn } from '@/lib/utils';
import type { QuestionPayload } from '@/lib/quiz/types';
import {
  BOT_COUNT, BOT_LEVELS, choicesOf, correctIndex, fmtPts, makeBots, playBots, ranking,
  type ArenaChoice, type Bot, type BotLevel, type Player,
} from '@/lib/arena';

type Target = { quizId?: string; courseId?: string };
type Next = {
  index: number; count: number; time_sec: number; hots: boolean; opens_at: string; server_now: string;
  score: number; streak: number; question: QuestionPayload;
};
type Answer = {
  correct: boolean; timeout: boolean; time_ms: number | null; base: number; bonus: number; points: number; streak: number;
  score: number; correct_count: number; finished: boolean; answer: any; explanation: string | null; explanation_locked: boolean;
};
type Round = { q: Next; choices: ArenaChoice[]; opensAt: number; endsAt: number };
type Reveal = { a: Answer; picked: number; key: number; counts: number[]; rank: number };
type Phase = 'lobby' | 'loading' | 'intro' | 'ask' | 'reveal' | 'board' | 'final';
type FriendRow = { name: string | null; best: number; runs: number; me: boolean };

const SHAPES = ['Segitiga', 'Belah ketupat', 'Lingkaran', 'Persegi'];
const KEYS: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };

function Shape({ i, className }: { i: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-7 w-7 shrink-0', className)} aria-hidden="true" fill="currentColor">
      {i === 0 && <path d="M12 3 22 20H2z" />}
      {i === 1 && <path d="M12 2 22 12 12 22 2 12z" />}
      {i === 2 && <circle cx="12" cy="12" r="9.5" />}
      {i === 3 && <rect x="3" y="3" width="18" height="18" rx="2" />}
    </svg>
  );
}

export function ArenaGame({ target, title, available, playerName, backHref }: {
  target: Target; title: string; available: number; playerName: string; backHref: string;
}) {
  const supabase = getSupabaseBrowser();
  const [phase, setPhase] = useState<Phase>('lobby');
  const [count, setCount] = useState<number | null>(Math.min(10, available));
  const [level, setLevel] = useState<BotLevel>('normal');
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [bots, setBots] = useState<Bot[]>([]);
  const [me, setMe] = useState({ name: playerName, score: 0, prev: 0 });
  const [stats, setStats] = useState({ correct: 0, bestStreak: 0, timeMs: 0, answered: 0, total: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  /* Pilihan yang sedang dikirim; tombol lain langsung diredupkan tanpa menunggu server */
  const [pending, setPending] = useState<number | null>(null);
  const answering = useRef(false);
  const botsRef = useRef<Bot[]>([]);
  botsRef.current = bots;

  /* ---------- Alur permainan ---------- */
  const fetchNext = useCallback(async (run: string) => {
    setPhase('loading');
    const { data, error: e } = await supabase.rpc('arena_next', { p_run: run });
    if (e) { setError(errorMessage(e)); setPhase('lobby'); return; }
    const q = data as Next;
    const skew = Date.parse(q.server_now) - Date.now();
    const opensAt = Date.parse(q.opens_at) - skew;
    answering.current = false;
    setPending(null);
    setError(null);
    setReveal(null);
    setRound({ q, choices: choicesOf(q.question), opensAt, endsAt: opensAt + q.time_sec * 1000 });
    setPhase(Date.now() < opensAt ? 'intro' : 'ask');
  }, [supabase]);

  async function start() {
    setError(null); setPhase('loading');
    const { data, error: e } = await supabase.rpc('arena_start', { p_quiz: target.quizId ?? null, p_course: target.courseId ?? null, p_count: count });
    if (e || !data) { setError(errorMessage(e)); setPhase('lobby'); return; }
    setRunId(data.run_id);
    setBots(makeBots(level));
    setMe({ name: playerName, score: 0, prev: 0 });
    setStats({ correct: 0, bestStreak: 0, timeMs: 0, answered: 0, total: data.count });
    setFriends(null);
    fetchNext(data.run_id);
  }

  const answer = useCallback(async (picked: number) => {
    if (!round || !runId || answering.current) return;
    answering.current = true;
    setPending(picked);
    const response = picked >= 0 ? round.choices[picked].response : null;
    const { data, error: e } = await supabase.rpc('arena_answer', { p_run: runId, p_response: response });
    /* Tetap terkunci saat gagal (tidak diulang otomatis); pemain memuat ulang soal lewat tombol */
    if (e) { setError(errorMessage(e)); return; }
    const a = data as Answer;
    const key = correctIndex(round.q.question, a.answer);
    const { bots: nb, picks } = playBots(botsRef.current, key, round.choices.length, round.q.time_sec, round.q.hots);
    const counts = round.choices.map((_, i) => picks.filter((p) => p === i).length + (picked === i ? 1 : 0));
    const nextMe = { name: playerName, score: a.score, prev: me.score };
    setBots(nb);
    setMe(nextMe);
    setStats((s) => ({
      ...s, correct: a.correct_count, bestStreak: Math.max(s.bestStreak, a.streak),
      timeMs: s.timeMs + (a.time_ms ?? 0), answered: s.answered + (a.timeout ? 0 : 1),
    }));
    setReveal({ a, picked, key, counts, rank: ranking(nb, nextMe).findIndex((p) => p.me) + 1 });
    setPhase('reveal');
  }, [round, runId, supabase, playerName, me.score]);

  /* Jam: intro → menjawab → waktu habis */
  useEffect(() => {
    if (phase !== 'intro' && phase !== 'ask') return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (!round) return;
      if (phase === 'intro' && n >= round.opensAt) setPhase('ask');
      if (phase === 'ask' && n >= round.endsAt) answer(-1);
    }, 100);
    return () => clearInterval(t);
  }, [phase, round, answer]);

  /* Keyboard: 1–4 atau A–D sesuai urutan warna */
  useEffect(() => {
    if (phase !== 'ask' || !round) return;
    const onKey = (e: KeyboardEvent) => {
      const i = KEYS[e.key.toLowerCase()];
      if (i !== undefined && i < round.choices.length) answer(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, round, answer]);

  /* Papan peringkat teman setelah selesai */
  useEffect(() => {
    if (phase !== 'final') return;
    supabase.rpc('arena_friends_leaderboard', { p_quiz: target.quizId ?? null, p_course: target.courseId ?? null })
      .then(({ data }) => setFriends((data as FriendRow[] | null) ?? []));
  }, [phase, supabase, target.quizId, target.courseId]);

  const board = ranking(bots, me);

  /* ---------- Tampilan ---------- */
  return (
    <div className="arena-stage relative overflow-hidden rounded-2xl border-2 border-ink p-4 shadow-brutal sm:p-8">
      <div className="mb-4 flex items-center justify-between gap-3 font-heading text-sm font-bold">
        <span className="truncate opacity-90">{title}</span>
        {round && phase !== 'lobby' && phase !== 'final' && (
          <span className="shrink-0 rounded-full bg-white/15 px-3 py-1">Soal {round.q.index + 1} / {round.q.count}</span>
        )}
      </div>

      {phase === 'lobby' && (
        <div className="mx-auto max-w-xl space-y-6 py-4 text-center">
          <div className="space-y-2">
            <p className="font-heading text-4xl font-extrabold">Arena</p>
            <p className="opacity-90">Kamu melawan {BOT_COUNT} bot. Jawab cepat dan tepat: makin cepat, makin besar poinnya. Jawaban benar beruntun memberi bonus.</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="mx-auto font-heading text-sm font-bold uppercase tracking-wide opacity-80">Jumlah soal</legend>
            <div className="flex flex-wrap justify-center gap-2">
              {[10, 20].filter((n) => n < available).map((n) => (
                <button key={n} type="button" onClick={() => setCount(n)} aria-pressed={count === n} className={cn('arena-chip', count === n && 'arena-chip-on')}>{n} soal</button>
              ))}
              <button type="button" onClick={() => setCount(available <= 10 ? available : null)} aria-pressed={count === null || count === available}
                className={cn('arena-chip', (count === null || count === available) && 'arena-chip-on')}>Semua ({Math.min(available, 50)})</button>
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mx-auto font-heading text-sm font-bold uppercase tracking-wide opacity-80">Lawan</legend>
            <div className="flex flex-wrap justify-center gap-2">
              {(Object.keys(BOT_LEVELS) as BotLevel[]).map((l) => (
                <button key={l} type="button" onClick={() => setLevel(l)} aria-pressed={level === l} className={cn('arena-chip', level === l && 'arena-chip-on')}>{BOT_LEVELS[l].label}</button>
              ))}
            </div>
            <p className="text-sm opacity-80">{BOT_LEVELS[level].help}</p>
          </fieldset>
          <Button size="lg" className="arena-btn h-12 px-8 text-base" onClick={start}>Mulai sebagai {playerName}</Button>
          <p className="text-xs opacity-75">Tekan 1–4 atau A–D di keyboard sesuai urutan warna.</p>
          {error && <p className="rounded-md bg-white/90 p-2 text-sm font-bold text-[#B0122C]" role="alert">{error}</p>}
        </div>
      )}

      {phase === 'loading' && <div className="grid min-h-[45vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin" aria-label="Memuat" /></div>}

      {(phase === 'intro' || phase === 'ask') && round && (
        <div className="space-y-5">
          {round.q.hots && <p className="mx-auto w-fit rounded-full bg-[#FFC93C] px-3 py-1 font-heading text-xs font-extrabold text-[#1A1A1A]">Soal HOTS: poin ganda</p>}
          <div className="rounded-xl bg-white p-4 text-center font-heading text-lg font-bold leading-snug text-[#1A1A1A] shadow-[0_4px_0_rgba(0,0,0,.25)] sm:p-6 sm:text-2xl"
            dangerouslySetInnerHTML={{ __html: rich(round.q.question.prompt) }} />
          {phase === 'intro' ? (
            <div className="space-y-3 py-6 text-center" aria-live="polite">
              <p className="font-heading text-sm font-bold opacity-85">Bersiap… waktu menjawab {round.q.time_sec} detik</p>
              <div className="mx-auto h-2 max-w-sm overflow-hidden rounded-full bg-white/20">
                <div className="h-full bg-white transition-[width] duration-100" style={{ width: `${Math.min(100, Math.max(0, 100 - ((round.opensAt - now) / 3000) * 100))}%` }} />
              </div>
            </div>
          ) : (
            <>
              <Timer left={Math.max(0, (round.endsAt - now) / 1000)} total={round.q.time_sec} />
              <div className="grid gap-3 sm:grid-cols-2">
                {round.choices.map((c, i) => (
                  <button key={i} type="button" onClick={() => answer(i)} aria-disabled={pending !== null}
                    aria-label={`${SHAPES[i]}: ${c.label.replace(/<[^>]*>/g, '')}`}
                    className={cn('arena-ans', `arena-c${i}`, pending !== null && pending !== i && 'opacity-40', pending === i && 'ring-4 ring-white')}>
                    <Shape i={i} />
                    <span className="text-left" dangerouslySetInnerHTML={{ __html: rich(c.label) }} />
                  </button>
                ))}
              </div>
              {pending !== null && !error && <p className="text-center font-heading text-sm font-bold opacity-85">{pending < 0 ? 'Waktu habis…' : 'Jawaban terkirim…'}</p>}
              {error && (
                <div className="flex flex-wrap items-center justify-center gap-2 rounded-md bg-white/90 p-2 text-sm font-bold text-[#B0122C]" role="alert">
                  {error}
                  <Button size="sm" variant="outline" onClick={() => runId && fetchNext(runId)}>Muat ulang soal</Button>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between font-heading text-sm font-bold opacity-90">
            <span>{playerName}</span>
            <span>Skor {fmtPts(me.score)}{round.q.streak > 1 && ` · Beruntun ×${round.q.streak}`}</span>
          </div>
        </div>
      )}

      {phase === 'reveal' && reveal && round && (
        <div className="mx-auto max-w-2xl space-y-5 text-center" role="status">
          <p className="font-heading text-4xl font-extrabold">{reveal.a.timeout ? 'Waktu habis' : reveal.a.correct ? 'Benar!' : 'Kurang tepat'}</p>
          {reveal.a.correct && (
            <p className="font-heading text-2xl font-extrabold">+{fmtPts(reveal.a.points)}
              {reveal.a.streak > 1 && <span className="ml-2 inline-flex items-center gap-1 text-base"><Flame className="h-4 w-4" /> Beruntun ×{reveal.a.streak}{reveal.a.bonus ? ` (bonus +${reveal.a.bonus})` : ''}</span>}
            </p>
          )}
          <Distribution choices={round.choices} counts={reveal.counts} correct={reveal.key} picked={reveal.picked} />
          <div className="space-y-2 rounded-xl bg-white p-4 text-left text-[#1A1A1A]">
            {reveal.key >= 0 && <p className="font-heading font-bold">Jawaban: <span dangerouslySetInnerHTML={{ __html: rich(round.choices[reveal.key].label) }} /></p>}
            {reveal.a.explanation && <p className="text-sm" dangerouslySetInnerHTML={{ __html: rich(reveal.a.explanation) }} />}
            {reveal.a.explanation_locked && <ExplanationLocked className="bg-[#F3EEFF] text-[#1A1A1A]" />}
          </div>
          <p className="font-heading font-bold">Skor {fmtPts(me.score)} · Peringkat {reveal.rank} dari {board.length}</p>
          <Button className="arena-btn" onClick={() => setPhase('board')} autoFocus>Papan skor</Button>
        </div>
      )}

      {phase === 'board' && round && (
        <div className="mx-auto max-w-xl space-y-5">
          <p className="text-center font-heading text-3xl font-extrabold">Papan skor</p>
          <Board players={board} />
          <div className="text-center">
            {reveal?.a.finished
              ? <Button className="arena-btn" onClick={() => setPhase('final')} autoFocus>Hasil akhir</Button>
              : <Button className="arena-btn" onClick={() => runId && fetchNext(runId)} autoFocus>Soal berikutnya</Button>}
          </div>
        </div>
      )}

      {phase === 'final' && (
        <Final players={board} stats={stats} score={me.score} runId={runId} friends={friends} backHref={backHref}
          onAgain={() => { setRound(null); setReveal(null); setPhase('lobby'); }} />
      )}
    </div>
  );
}

function Timer({ left, total }: { left: number; total: number }) {
  const sec = Math.ceil(left);
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white font-heading text-xl font-extrabold text-[#46178F]', sec <= 5 && 'animate-pulse text-[#E21B3C]')}>{sec}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/20">
        <span className="block h-full origin-left bg-white" style={{ transform: `scaleX(${left / total})` }} />
      </span>
    </div>
  );
}

function Distribution({ choices, counts, correct, picked }: { choices: ArenaChoice[]; counts: number[]; correct: number; picked: number }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="flex h-36 items-end justify-center gap-3" aria-label="Sebaran jawaban">
      {choices.map((c, i) => (
        <div key={i} className="flex w-14 flex-col items-center gap-1 sm:w-20">
          <span className="font-heading text-sm font-extrabold">{counts[i]}</span>
          <span className={cn('w-full rounded-t-md', `arena-c${i}`, i !== correct && 'opacity-45')} style={{ height: `${Math.max(6, (counts[i] / max) * 96)}px` }} />
          <span className={cn('flex items-center gap-1 rounded-md px-1.5 py-0.5', `arena-c${i}`, i === picked && 'ring-2 ring-white')}>
            <Shape i={i} className="h-4 w-4" />{i === correct && <span className="font-heading text-xs font-extrabold">✓</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function Board({ players }: { players: Player[] }) {
  const top = Math.max(1, players[0]?.score ?? 1);
  return (
    <ol className="space-y-2">
      {players.slice(0, 8).map((p, i) => (
        <li key={p.name + i} className={cn('relative overflow-hidden rounded-lg px-3 py-2 font-heading font-bold', p.me ? 'bg-[#FFC93C] text-[#1A1A1A]' : 'bg-white/15')}>
          <span className={cn('absolute inset-y-0 left-0 transition-[width] duration-700', p.me ? 'bg-black/10' : 'bg-white/10')} style={{ width: `${(p.score / top) * 100}%` }} aria-hidden="true" />
          <span className="relative flex justify-between gap-3">
            <span className="truncate">{i + 1}. {p.name}{p.me && ' (kamu)'}</span>
            <span>{fmtPts(p.score)}{p.score > p.prev && <small className="ml-1 opacity-70">+{fmtPts(p.score - p.prev)}</small>}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Final({ players, stats, score, runId, friends, backHref, onAgain }: {
  players: Player[]; stats: { correct: number; bestStreak: number; timeMs: number; answered: number; total: number };
  score: number; runId: string | null; friends: FriendRow[] | null; backHref: string; onAgain: () => void;
}) {
  const rank = players.findIndex((p) => p.me) + 1;
  const acc = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
  const podium = [players[1], players[0], players[2]];
  const msg = rank === 1 ? 'Juara 1! Pemahamanmu sudah kuat.' : rank <= 3 ? 'Masuk podium, sedikit lagi ke puncak.'
    : acc >= 70 ? 'Pemahamanmu bagus; percepat lagi jawabanmu.' : 'Pelajari lagi materinya, lalu coba lagi.';
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <p className="font-heading text-3xl font-extrabold">Hasil akhir</p>
      <div className="flex items-end justify-center gap-2 sm:gap-4" aria-label="Podium">
        {podium.map((p, k) => p && (
          <div key={p.name} className="flex w-24 flex-col items-center gap-1 sm:w-32">
            {k === 1 && <Crown className="h-6 w-6 text-[#FFC93C]" />}
            <span className={cn('w-full truncate font-heading text-sm font-bold', p.me && 'text-[#FFC93C]')}>{p.name}</span>
            <span className="font-heading text-xs opacity-85">{fmtPts(p.score)}</span>
            <span className={cn('grid w-full place-items-center rounded-t-lg font-heading text-2xl font-extrabold', k === 1 ? 'h-28 bg-[#FFC93C] text-[#1A1A1A]' : k === 0 ? 'h-20 bg-white/80 text-[#1A1A1A]' : 'h-14 bg-[#D89E00] text-[#1A1A1A]')}>
              {k === 1 ? 1 : k === 0 ? 2 : 3}
            </span>
          </div>
        ))}
      </div>
      <p className="font-bold">Peringkatmu: {rank} dari {players.length}. {msg}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [fmtPts(score), 'Skor total'], [`${stats.correct}/${stats.total}`, `Benar (${acc}%)`],
          [`×${stats.bestStreak}`, 'Beruntun terbaik'], [stats.answered ? `${fmtNum(stats.timeMs / stats.answered / 1000)} dtk` : '–', 'Rata-rata waktu'],
        ].map(([v, k]) => (
          <div key={k} className="rounded-lg bg-white/15 p-3"><div className="font-heading text-xl font-extrabold">{v}</div><div className="text-xs opacity-85">{k}</div></div>
        ))}
      </div>

      <div className="rounded-xl bg-white/10 p-4 text-left">
        <p className="mb-2 flex items-center gap-2 font-heading font-bold"><Users className="h-4 w-4" /> Skor terbaik bersama teman</p>
        {friends === null ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Memuat" /> : friends.length <= 1 ? (
          <p className="text-sm opacity-85">Belum ada teman yang memainkan Arena ini. <Link href="/dashboard/friends" className="font-bold text-white">Tambah teman</Link> lalu tantang mereka mengalahkan skormu.</p>
        ) : (
          <ol className="space-y-1 font-heading text-sm">
            {friends.map((f, i) => (
              <li key={i} className={cn('flex justify-between rounded-md px-2 py-1', f.me && 'bg-[#FFC93C] text-[#1A1A1A]')}>
                <span>{i + 1}. {f.name ?? 'Tanpa nama'}{f.me && ' (kamu)'}</span><span className="font-bold">{fmtPts(f.best)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button className="arena-btn" onClick={onAgain}><Trophy className="mr-1 h-4 w-4" /> Main lagi</Button>
        {runId && <Button asChild variant="outline" className="border-white bg-transparent text-white hover:bg-white/10 hover:text-white"><Link href={`/arena/runs/${runId}`}>Tinjau jawaban</Link></Button>}
        <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white"><Link href={backHref}>Kembali</Link></Button>
      </div>
    </div>
  );
}
