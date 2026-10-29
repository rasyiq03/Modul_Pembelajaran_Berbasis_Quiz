'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Download, Eye, Loader2, Play, SkipForward, Square, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AnswerInput, Prompt } from '@/components/quiz/answer-input';
import { Leaderboard } from '@/components/live/leaderboard';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage, fmtDateTime, fmtNum } from '@/lib/labels';
import { useSessionState } from '@/lib/quiz/use-session-state';
import { describeAnswer } from '@/lib/quiz/types';
import { toCsv } from '@/lib/csv';
import { rich } from '@/lib/rich';
import { cn } from '@/lib/utils';

type Action = 'start' | 'reveal' | 'next' | 'end' | 'cancel';

export function HostConsole({ sessionId }: { sessionId: string }) {
  const supabase = getSupabaseBrowser();
  const { state: s, error, secondsLeft, refresh } = useSessionState(sessionId, 1200);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const autoRevealed = useRef<number>(-1);
  const joinUrl = typeof window !== 'undefined' && s?.code ? `${window.location.origin}/join?code=${s.code}` : '';

  async function act(a: Action) {
    if (a === 'end' && !confirm('Akhiri sesi sekarang?')) return;
    if (a === 'cancel' && !confirm('Batalkan sesi? Peserta tidak bisa melanjutkan.')) return;
    setBusy(true); setMsg(null);
    const { error: e } = await supabase.rpc('host_session_action', { p_session: sessionId, p_action: a });
    setBusy(false);
    if (e) setMsg(errorMessage(e));
    refresh();
  }

  /* Waktu soal habis → buka jawaban otomatis (sekali per soal) */
  useEffect(() => {
    if (s?.phase === 'question' && secondsLeft === 0 && autoRevealed.current !== s.index) {
      autoRevealed.current = s.index;
      act('reveal');
    }
  }, [secondsLeft, s?.phase, s?.index]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Semua peserta sudah menjawab → buka jawaban lebih awal */
  useEffect(() => {
    if (s?.phase === 'question' && s.participants > 0 && s.answered >= s.participants && autoRevealed.current !== s.index) {
      autoRevealed.current = s.index;
      act('reveal');
    }
  }, [s?.answered, s?.participants, s?.phase, s?.index]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadResults() {
    const { data, error: e } = await supabase.rpc('get_session_results', { p_session: sessionId });
    if (e) return setMsg(errorMessage(e));
    setResults(data);
  }
  useEffect(() => { if (s?.phase === 'ended') loadResults(); }, [s?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function downloadCsv() {
    if (!results) return;
    const rows = [['Peringkat', 'Nama tampilan', 'Email', 'Tamu', 'Skor', 'Benar', 'Dijawab', 'Bergabung']];
    results.participants.forEach((p: any, i: number) => rows.push([String(i + 1), p.nickname, p.email ?? '', p.is_guest ? 'ya' : 'tidak', String(p.score), String(p.correct), String(p.answered), p.joined_at]));
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `sesi-${s?.code ?? sessionId}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  if (!s) return error ? <p className="text-destructive">{error}</p> : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
  const q = s.question;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="font-heading text-sm font-bold uppercase tracking-[0.12em] opacity-80">Kode sesi</p>
            <p className="font-heading text-[clamp(3rem,10vw,5.5rem)] font-extrabold leading-none tracking-[0.15em]" data-testid="session-code">{s.code}</p>
            {joinUrl && (
              <button type="button" onClick={() => navigator.clipboard?.writeText(joinUrl)} className="inline-flex items-center gap-1.5 rounded-md bg-black/20 px-3 py-1.5 font-heading text-sm font-bold text-primary-foreground">
                <Copy className="h-4 w-4" /> {joinUrl.replace(/^https?:\/\//, '')}
              </button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5 font-heading">
            <p className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4" /> {s.participants} peserta</p>
            <p className="text-sm text-muted-foreground">
              {s.phase === 'lobby' && 'Menunggu peserta bergabung.'}
              {s.phase === 'question' && `Soal ${s.index + 1}/${s.count} · ${s.answered} sudah menjawab`}
              {s.phase === 'reveal' && `Jawaban soal ${s.index + 1}/${s.count} dibuka`}
              {s.phase === 'ended' && (s.status === 'cancelled' ? 'Sesi dibatalkan.' : 'Sesi selesai.')}
            </p>
            <div className="flex flex-wrap gap-2">
              {s.phase === 'lobby' && <Button onClick={() => act('start')} disabled={busy || s.participants === 0}><Play className="mr-1 h-4 w-4" /> Mulai</Button>}
              {s.phase === 'question' && <Button onClick={() => act('reveal')} disabled={busy}><Eye className="mr-1 h-4 w-4" /> Buka jawaban</Button>}
              {s.phase === 'reveal' && <Button onClick={() => act('next')} disabled={busy}><SkipForward className="mr-1 h-4 w-4" /> {s.index + 1 >= s.count ? 'Selesai' : 'Soal berikutnya'}</Button>}
              {s.phase !== 'ended' && s.phase !== 'lobby' && <Button variant="outline" onClick={() => act('end')} disabled={busy}><Square className="mr-1 h-4 w-4" /> Akhiri</Button>}
              {s.phase === 'lobby' && <Button variant="ghost" onClick={() => act('cancel')} disabled={busy}>Batalkan</Button>}
            </div>
            {msg && <p className="text-sm text-destructive" role="alert">{msg}</p>}
          </CardContent>
        </Card>
      </div>

      {q && (s.phase === 'question' || s.phase === 'reveal') && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center justify-between font-heading text-sm">
              <span className="font-bold">Soal {s.index + 1} dari {s.count}</span>
              {s.phase === 'question' && secondsLeft !== null && <span className={cn('rounded-full bg-secondary px-3 py-1 text-lg font-extrabold', secondsLeft <= 5 && 'bg-destructive text-destructive-foreground')}>{secondsLeft}</span>}
            </div>
            <Prompt html={q.prompt} className="text-xl sm:text-2xl" />
            <AnswerInput question={q} value={undefined} onChange={() => undefined} disabled reveal={s.phase === 'reveal' ? s.answer : null} />
            {s.phase === 'reveal' && s.answer && <p><b>Jawaban:</b> <span dangerouslySetInnerHTML={{ __html: rich(describeAnswer(q, s.answer)) }} /></p>}
            {s.phase === 'reveal' && s.explanation && <p className="note-box text-sm" dangerouslySetInnerHTML={{ __html: rich(s.explanation) }} />}
          </CardContent>
        </Card>
      )}

      {s.leaderboard && s.leaderboard.length > 0 && <Leaderboard rows={s.leaderboard} limit={s.phase === 'ended' ? undefined : 10} />}

      {s.phase === 'ended' && results && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Hasil peserta</CardTitle>
            <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="mr-1 h-4 w-4" /> Unduh CSV</Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Skor</TableHead><TableHead>Benar</TableHead><TableHead>Bergabung</TableHead></TableRow></TableHeader>
              <TableBody>
                {results.participants.map((p: any, i: number) => (
                  <TableRow key={p.participant_id}>
                    <TableCell>{i + 1}</TableCell><TableCell>{p.nickname}{p.is_guest ? ' (tamu)' : ''}</TableCell><TableCell>{p.email ?? '–'}</TableCell>
                    <TableCell>{fmtNum(p.score, 0)}</TableCell><TableCell>{p.correct}/{s.count}</TableCell><TableCell>{fmtDateTime(p.joined_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <h3 className="mb-2 mt-6 text-base">Tingkat jawaban benar per soal</h3>
            <ul className="space-y-1 font-heading text-sm">
              {results.per_question.map((x: any) => (
                <li key={x.index} className="flex items-center gap-3">
                  <span className="w-16">Soal {x.index + 1}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full bg-success" style={{ width: `${x.answered ? (x.correct / x.answered) * 100 : 0}%` }} /></span>
                  <span className="w-24 text-right">{x.correct}/{x.answered} benar</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
