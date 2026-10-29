'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage } from '@/lib/labels';
import type { QuestionPayload } from '@/lib/quiz/types';

export type SessionState = {
  session_id: string; code: string | null; status: 'waiting' | 'active' | 'completed' | 'cancelled';
  phase: 'lobby' | 'question' | 'reveal' | 'ended'; quiz_title: string; index: number; count: number;
  question_time_sec: number; question_started_at: string | null; server_now: string;
  question: QuestionPayload | null; answer: any; explanation: string | null; answered: number; participants: number;
  me: null | { participant_id: string; nickname: string; score: number; correct: number; answered_current: boolean; last: { is_correct: boolean | null; points: number } | null };
  leaderboard: { nickname: string; score: number; correct: number; me: boolean }[] | null;
};

/**
 * FR-54: keadaan sesi live dari server. Realtime (bila aktif di proyek Supabase) memicu muat ulang
 * seketika; polling tetap berjalan sebagai cadangan. `secondsLeft` memakai jam server.
 */
export function useSessionState(sessionId: string, pollMs = 1500) {
  const supabase = getSupabaseBrowser();
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const skew = useRef(0);

  const refresh = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('get_session_state', { p_session: sessionId });
    if (e) { setError(errorMessage(e)); return null; }
    const s = data as SessionState;
    skew.current = Date.parse(s.server_now) - Date.now();
    setError(null);
    setState(s);
    return s;
  }, [supabase, sessionId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, pollMs);
    const ch = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${sessionId}` }, () => refresh())
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };   // FR-60: kembali dari latar belakang
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); supabase.removeChannel(ch); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh, supabase, sessionId, pollMs]);

  useEffect(() => {
    if (!state || state.phase !== 'question' || !state.question_started_at) { setSecondsLeft(null); return; }
    const end = Date.parse(state.question_started_at) + state.question_time_sec * 1000;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((end - (Date.now() + skew.current)) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [state]);

  return { state, error, secondsLeft, refresh };
}
