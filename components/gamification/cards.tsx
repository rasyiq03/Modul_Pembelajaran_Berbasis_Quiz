import Link from 'next/link';
import { Flame, Medal, Sparkles, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XpBar } from '@/components/gamification/level-parts';
import { BADGES, XP_RULES, groupXp, levelProgress, type MyProgress, type XpEvent } from '@/lib/gamification';
import { fmtDateTime, fmtNum } from '@/lib/labels';
import { cn } from '@/lib/utils';

/** Kartu level: avatar, gelar, bilah XP, dan statistik singkat */
export function LevelCard({ progress, avatar, name }: { progress: MyProgress; avatar: string; name: string }) {
  const lp = levelProgress(Number(progress.xp));
  const stats = [
    { label: 'XP 7 hari', value: `+${fmtNum(progress.week_xp, 0)}`, icon: Sparkles },
    { label: 'Hari beruntun', value: fmtNum(progress.streak, 0), icon: Flame },
    { label: 'Lencana', value: `${progress.badges.length}/${BADGES.length}`, icon: Medal },
    { label: 'Peringkat', value: `#${fmtNum(progress.rank, 0)}`, icon: Trophy, href: '/leaderboard' },
  ];
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-secondary text-4xl" aria-hidden>{avatar}</span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="eyebrow">Level {lp.level} · {lp.name}</p>
            <p className="truncate font-heading text-xl font-extrabold">{name}</p>
            <XpBar pct={lp.pct} className="h-2.5" />
            <p className="font-heading text-xs font-bold text-muted-foreground">
              {fmtNum(progress.xp, 0)} XP · {fmtNum(lp.toNext, 0)} XP lagi ke level {lp.level + 1}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => {
            const body = (
              <div className="rounded-md bg-secondary px-3 py-2.5">
                <dt className="flex items-center gap-1 font-heading text-[0.7rem] font-bold text-muted-foreground"><s.icon className="h-3.5 w-3.5" /> {s.label}</dt>
                <dd className="font-heading text-lg font-extrabold text-foreground">{s.value}</dd>
              </div>
            );
            return s.href ? <Link key={s.label} href={s.href} className="no-underline">{body}</Link> : <div key={s.label}>{body}</div>;
          })}
        </dl>
      </CardContent>
    </Card>
  );
}

export function BadgeGrid({ earned, compact }: { earned: { badge: string; earned_at: string }[]; compact?: boolean }) {
  const got = new Map(earned.map((b) => [b.badge, b.earned_at]));
  const list = compact ? BADGES.filter((b) => got.has(b.id)).slice(-6) : BADGES;
  if (compact && list.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada lencana. Selesaikan kuis pertamamu untuk mendapat 🎯 Langkah pertama.</p>;
  }
  return (
    <ul className={cn('grid gap-3', compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4')}>
      {list.map((b) => {
        const at = got.get(b.id);
        return (
          <li key={b.id} className={cn('flex items-start gap-3 rounded-md border-[1.5px] p-3', at ? 'border-primary/40 bg-card' : 'border-dashed bg-muted/30 opacity-60')} title={b.desc}>
            <span className={cn('text-2xl leading-none', !at && 'grayscale')} aria-hidden>{b.icon}</span>
            <span className="min-w-0">
              <b className="block font-heading text-sm">{b.name}</b>
              <span className="block text-xs leading-snug text-muted-foreground">{b.desc}</span>
              {at && !compact && <span className="mt-1 block font-heading text-[0.68rem] font-bold text-primary">Didapat {fmtDateTime(at)}</span>}
              {!at && <span className="sr-only">Belum didapat</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function XpHistory({ events }: { events: XpEvent[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">Belum ada XP. Kerjakan kuis atau tandai bab materi yang sudah kamu pahami.</p>;
  return (
    <ul className="divide-y divide-border">
      {events.map((e, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="min-w-0"><span className="block truncate font-heading font-bold">{e.label}</span><span className="text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span></span>
          <span className="shrink-0 font-heading font-extrabold text-primary">+{fmtNum(e.amount, 0)} XP</span>
        </li>
      ))}
    </ul>
  );
}

export function XpRules() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Cara mendapat XP</CardTitle></CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          {XP_RULES.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4"><dt className="min-w-0 text-muted-foreground">{k}</dt><dd className="max-w-[55%] text-right font-heading font-bold">{v}</dd></div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/** Rincian XP dari satu percobaan/sesi, plus lencana baru */
export function XpGainBox({ events, badges, total }: { events: { label: string; amount: number }[]; badges: string[]; total: number }) {
  const gained = events.reduce((s, e) => s + e.amount, 0);
  const lp = levelProgress(total);
  const before = levelProgress(total - gained);
  const rows = groupXp(events);
  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-heading text-lg font-extrabold">+{fmtNum(gained, 0)} XP</p>
          <p className="font-heading text-xs font-bold text-muted-foreground">
            Level {lp.level} {lp.name}{lp.level > before.level ? ' · naik level!' : ''}
          </p>
        </div>
        {rows.length > 0 && (
          <ul className="space-y-1 text-sm">
            {rows.map((r) => (
              <li key={r.label} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{r.label}{r.count > 1 ? ` ×${r.count}` : ''}</span>
                <span className="font-heading font-bold">+{fmtNum(r.amount, 0)}</span>
              </li>
            ))}
          </ul>
        )}
        {gained === 0 && <p className="text-sm text-muted-foreground">Tidak ada XP baru dari percobaan ini (XP selesai kuis dihitung sekali per kuis per hari).</p>}
        <XpBar pct={lp.pct} className="h-2" />
        <p className="font-heading text-xs text-muted-foreground">{fmtNum(total, 0)} XP · {fmtNum(lp.toNext, 0)} XP lagi ke level {lp.level + 1}</p>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {badges.map((id) => {
              const b = BADGES.find((x) => x.id === id);
              return b ? <span key={id} className="rounded-full bg-secondary px-3 py-1 font-heading text-xs font-bold">{b.icon} Lencana baru: {b.name}</span> : null;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
