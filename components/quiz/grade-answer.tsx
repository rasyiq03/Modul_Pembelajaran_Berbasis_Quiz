'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage } from '@/lib/labels';

/** Admin: nilai manual satu jawaban (esai / jawaban singkat) */
export function GradeAnswer({ answerId, max, current }: { answerId: string; max: number; current: number }) {
  const router = useRouter();
  const [points, setPoints] = useState(String(current));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function save() {
    setBusy(true); setMsg(null);
    const { error } = await getSupabaseBrowser().rpc('grade_attempt_answer', { p_answer: answerId, p_points: Number(points) });
    setBusy(false);
    if (error) return setMsg(errorMessage(error));
    setMsg('Nilai tersimpan.');
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-secondary p-3 font-heading text-sm">
      <label htmlFor={`g-${answerId}`} className="font-bold">Nilai manual</label>
      <Input id={`g-${answerId}`} type="number" min={0} max={max} step="0.5" value={points} onChange={(e) => setPoints(e.target.value)} className="h-9 w-24" />
      <span className="text-muted-foreground">/ {max}</span>
      <Button size="sm" onClick={save} disabled={busy}>Simpan</Button>
      {msg && <span className="text-muted-foreground">{msg}</span>}
    </div>
  );
}
