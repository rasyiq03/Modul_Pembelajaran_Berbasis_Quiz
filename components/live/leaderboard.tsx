import { fmtNum } from '@/lib/labels';
import { cn } from '@/lib/utils';

/** FR-57: papan peringkat sesi live */
export function Leaderboard({ rows, limit }: { rows: { nickname: string; score: number; correct: number; me: boolean }[]; limit?: number }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  const mine = rows.findIndex((r) => r.me);
  const max = Math.max(1, ...rows.map((r) => Number(r.score)));
  return (
    <section aria-label="Papan peringkat" className="space-y-2">
      <h2 className="text-lg">Papan peringkat</h2>
      <ol className="space-y-1.5">
        {shown.map((r, i) => (
          <li key={r.nickname} className={cn('relative overflow-hidden rounded-md border-[1.5px] bg-card px-4 py-2.5 font-heading text-sm', r.me && 'border-primary')}>
            <div className="absolute inset-y-0 left-0 bg-secondary" style={{ width: `${(Number(r.score) / max) * 100}%` }} aria-hidden="true" />
            <div className="relative flex items-center gap-3">
              <span className="w-6 font-extrabold">{i + 1}</span>
              <span className="flex-1 font-bold">{r.nickname}{r.me ? ' (kamu)' : ''}</span>
              <span className="font-extrabold">{fmtNum(r.score, 0)}</span>
            </div>
          </li>
        ))}
      </ol>
      {limit && mine >= limit && <p className="font-heading text-sm text-muted-foreground">Peringkatmu: {mine + 1} dari {rows.length}</p>}
    </section>
  );
}
