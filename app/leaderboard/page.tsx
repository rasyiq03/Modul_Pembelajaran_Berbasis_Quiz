import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/site/page-parts';
import { XpRules } from '@/components/gamification/cards';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getViewer } from '@/lib/auth';
import { levelProgress } from '@/lib/gamification';
import { fmtNum } from '@/lib/labels';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Peringkat · KuisKelas' };

type Row = { rank: number; name: string; avatar: string; xp: number; total: number; me: boolean };

export default async function LeaderboardPage({ searchParams }: { searchParams: { period?: string } }) {
  const period = searchParams.period === 'week' ? 'week' : 'all';
  const [{ data }, viewer] = await Promise.all([
    createSupabaseServer().rpc('xp_leaderboard', { p_period: period, p_limit: 50 }),
    getViewer(),
  ]);
  const rows = (data ?? []) as Row[];
  const tabs = [{ v: 'all', label: 'Sepanjang waktu' }, { v: 'week', label: '7 hari terakhir' }];

  return (
    <div className="container-wide space-y-6 py-8 sm:py-10">
      <PageHeader
        title="Papan peringkat"
        description="Peringkat XP pengguna terdaftar dari kuis, kuis live, dan belajar di materi. Hanya nama tampilan yang ditampilkan."
        actions={
          <nav className="pill-tabs inline-flex" aria-label="Periode">
            {tabs.map((t) => (
              <Link key={t.v} href={t.v === 'all' ? '/leaderboard' : '/leaderboard?period=week'} aria-current={period === t.v ? 'page' : undefined}
                className={cn('whitespace-nowrap rounded-full px-3.5 py-1.5 font-heading text-[0.8rem] font-bold no-underline', period === t.v ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background/70')}>
                {t.label}
              </Link>
            ))}
          </nav>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          {rows.length === 0 ? (
            <EmptyState title="Belum ada XP" description={period === 'week' ? 'Belum ada yang mengumpulkan XP minggu ini.' : 'Kerjakan kuis untuk menjadi yang pertama di papan peringkat.'} icon={<Trophy className="h-8 w-8" />} />
          ) : (
            <Card>
              <CardContent className="p-2 sm:p-3">
                <ol className="space-y-1.5">
                  {rows.map((r) => {
                    const lp = levelProgress(Number(r.total));
                    return (
                      <li key={`${r.rank}-${r.name}`} className={cn('flex items-center gap-3 rounded-md px-3 py-2.5', r.me ? 'bg-primary text-primary-foreground' : r.rank <= 3 ? 'bg-secondary' : '')}>
                        <span className="w-7 text-center font-heading text-lg font-extrabold">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-xl" aria-hidden>{r.avatar}</span>
                        <span className="min-w-0 flex-1">
                          <b className="block truncate font-heading text-sm">{r.name}{r.me ? ' (kamu)' : ''}</b>
                          <span className={cn('font-heading text-xs', r.me ? 'text-primary-foreground/80' : 'text-muted-foreground')}>Level {lp.level} · {lp.name}</span>
                        </span>
                        <span className="font-heading text-sm font-extrabold">{fmtNum(r.xp, 0)} XP</span>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}
          {!viewer.isRegistered && (
            <div className="note-box flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>Tamu tidak mengumpulkan XP. Buat akun agar XP, level, dan lencanamu tersimpan.</span>
              <Button asChild size="sm"><Link href="/signup?next=/leaderboard">Buat akun</Link></Button>
            </div>
          )}
        </div>
        <div><XpRules /></div>
      </div>
    </div>
  );
}
