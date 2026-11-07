import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';
import { fmtDateTime } from '@/lib/labels';
import { fmtPts } from '@/lib/arena';
import type { MyArenaRun } from '@/lib/dashboard';

export function ArenaRunList({ runs }: { runs: MyArenaRun[] }) {
  if (!runs.length) {
    return <p className="text-sm text-muted-foreground">Belum pernah main Arena. <Link href="/quizzes">Coba sekarang</Link>.</p>;
  }
  return (
    <ul className="divide-y rounded-md border-[1.5px] font-heading text-sm">
      {runs.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2">
            <Gamepad2 className="h-4 w-4 shrink-0 text-violet" />
            <span className="min-w-0">
              <b className="block truncate">{r.quizzes?.title ?? (r.courses ? `Arena acak · ${r.courses.title}` : 'Arena')}</b>
              <span className="text-xs text-muted-foreground">{fmtDateTime(r.finished_at)}</span>
            </span>
          </span>
          <span className="flex items-center gap-3">
            <b>{fmtPts(r.score)}</b>
            <span className="text-muted-foreground">{r.correct}/{r.question_order.length} benar</span>
            <Link href={`/arena/runs/${r.id}`}>Tinjau</Link>
          </span>
        </li>
      ))}
    </ul>
  );
}
