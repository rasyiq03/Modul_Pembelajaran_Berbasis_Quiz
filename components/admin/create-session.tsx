'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { QUIZ_MODE_LABEL, STATUS_LABEL, errorMessage } from '@/lib/labels';
import type { QuizMode, Status } from '@/lib/database.types';

/** FR-48/49: buat sesi live dari kuis mana pun, dengan pengaturan partisipasi sesi */
export function CreateSession({ quizzes, defaultQuiz }: { quizzes: { id: string; title: string; mode: string; status: string; settings: any }[]; defaultQuiz?: string }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState(defaultQuiz ?? quizzes.find((q) => q.mode === 'live_competition')?.id ?? quizzes[0]?.id ?? '');
  const sel = quizzes.find((q) => q.id === quiz);
  const [guests, setGuests] = useState(true);
  const [board, setBoard] = useState(true);
  const [secs, setSecs] = useState('');
  const [max, setMax] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true); setError(null);
    const { data, error: e } = await getSupabaseBrowser().rpc('create_quiz_session', {
      p_quiz: quiz,
      p_settings: { allow_guests: guests, show_leaderboard: board, question_time_sec: secs ? Number(secs) : undefined, max_participants: max ? Number(max) : undefined },
    });
    if (e) { setBusy(false); return setError(errorMessage(e)); }
    router.push(`/admin/sessions/${data.session_id}`);
  }

  if (!quizzes.length) return <p className="note-box text-sm">Buat kuis dulu di menu Kuis sebelum membuka sesi live.</p>;
  return (
    <Card>
      <CardContent className="grid gap-4 p-5 md:grid-cols-[2fr_1fr_1fr] md:items-end">
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="sq">Kuis</Label>
          <select id="sq" value={quiz} onChange={(e) => setQuiz(e.target.value)} className="h-10 w-full rounded-md border-[1.5px] border-input bg-background px-3 font-heading text-sm">
            {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title} · {QUIZ_MODE_LABEL[q.mode as QuizMode]} · {STATUS_LABEL[q.status as Status]}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ss">Waktu per soal (detik)</Label>
          <Input id="ss" type="number" min={5} max={600} placeholder={String(sel?.settings?.question_time_sec ?? 30)} value={secs} onChange={(e) => setSecs(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sm">Maks. peserta</Label>
          <Input id="sm" type="number" min={1} placeholder="Tanpa batas" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2 font-heading text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={guests} onChange={(e) => setGuests(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" /> Tamu boleh bergabung</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={board} onChange={(e) => setBoard(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" /> Tampilkan papan peringkat</label>
        </div>
        <div className="md:col-span-3">
          {error && <p className="mb-2 text-sm text-destructive" role="alert">{error}</p>}
          <Button onClick={create} disabled={busy || !quiz}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Radio className="mr-1 h-4 w-4" />} Buat sesi</Button>
        </div>
      </CardContent>
    </Card>
  );
}
