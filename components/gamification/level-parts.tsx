'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-provider';
import { useXp } from '@/components/gamification/xp-provider';
import { levelProgress } from '@/lib/gamification';
import { fmtNum } from '@/lib/labels';
import { cn } from '@/lib/utils';

export function XpBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <span className={cn('block h-1.5 overflow-hidden rounded-full bg-secondary', className)} aria-hidden>
      <i className="block h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

/** Chip avatar + level di header, seperti chip profil di materi */
export function LevelChip({ className }: { className?: string }) {
  const { profile } = useAuth();
  const { xp } = useXp();
  if (xp == null) return null;
  const lp = levelProgress(xp);
  return (
    <Link
      href="/dashboard/achievements"
      className={cn('flex items-center gap-2 rounded-full bg-secondary py-1 pl-1 pr-3 font-heading text-foreground no-underline transition-colors hover:bg-accent', className)}
      title={`Level ${lp.level} (${lp.name}) · ${fmtNum(xp, 0)} XP · ${fmtNum(lp.toNext, 0)} XP lagi ke level ${lp.level + 1}`}
      aria-label={`Pencapaian: level ${lp.level} ${lp.name}, ${fmtNum(xp, 0)} XP`}
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-card text-base" aria-hidden>{profile?.avatar ?? '🦉'}</span>
      <span className="flex min-w-[4.5rem] flex-col gap-1">
        <b className="whitespace-nowrap text-[0.72rem] font-extrabold leading-none">Lv {lp.level} · {fmtNum(xp, 0)} XP</b>
        <XpBar pct={lp.pct} />
      </span>
    </Link>
  );
}

/** Segarkan total XP di header setelah halaman server mencatat XP baru (mis. hasil kuis) */
export function XpSync() {
  const { refresh } = useXp();
  useEffect(() => { refresh(); }, [refresh]);
  return null;
}
