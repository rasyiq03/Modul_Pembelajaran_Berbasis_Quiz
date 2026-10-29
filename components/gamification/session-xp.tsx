'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/supabase/auth-provider';
import { useXp } from '@/components/gamification/xp-provider';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { BADGE, groupXp } from '@/lib/gamification';
import { fmtNum } from '@/lib/labels';

/** XP & lencana dari satu sesi live; dicatat server saat sesi berakhir */
export function SessionXp({ sessionId }: { sessionId: string }) {
  const { user } = useAuth();
  const { refresh } = useXp();
  const [data, setData] = useState<{ events: { label: string; amount: number }[]; badges: string[] } | null>(null);
  const guest = !user || user.is_anonymous;

  useEffect(() => {
    if (guest) return;
    const sb = getSupabaseBrowser();
    Promise.all([
      sb.from('xp_events').select('label, amount').eq('meta->>session', sessionId).order('id'),
      sb.from('user_badges').select('badge').eq('source', `session:${sessionId}`),
    ]).then(([e, b]) => {
      setData({ events: e.data ?? [], badges: (b.data ?? []).map((x) => x.badge) });
      refresh();
    });
  }, [guest, sessionId, refresh]);

  if (guest) {
    return (
      <div className="note-box flex flex-wrap items-center justify-between gap-3 text-left text-sm">
        <span>Kamu bermain sebagai tamu, jadi sesi ini tidak menambah XP. Buat akun untuk mengumpulkan XP, level, dan lencana.</span>
        <Button asChild size="sm"><Link href="/signup">Buat akun</Link></Button>
      </div>
    );
  }
  if (!data) return null;
  const total = data.events.reduce((s, e) => s + e.amount, 0);
  return (
    <div className="rounded-md bg-secondary p-4 text-left">
      <p className="font-heading text-lg font-extrabold">+{fmtNum(total, 0)} XP dari sesi ini</p>
      <ul className="mt-2 space-y-1 text-sm">
        {groupXp(data.events).map((r) => (
          <li key={r.label} className="flex justify-between gap-3"><span className="text-muted-foreground">{r.label}{r.count > 1 ? ` ×${r.count}` : ''}</span><b className="font-heading">+{fmtNum(r.amount, 0)}</b></li>
        ))}
      </ul>
      {data.badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {data.badges.map((id) => BADGE[id] && <span key={id} className="rounded-full bg-card px-3 py-1 font-heading text-xs font-bold">{BADGE[id].icon} Lencana baru: {BADGE[id].name}</span>)}
        </div>
      )}
      <Link href="/dashboard/achievements" className="mt-3 inline-block font-heading text-sm font-bold">Lihat pencapaian</Link>
    </div>
  );
}
