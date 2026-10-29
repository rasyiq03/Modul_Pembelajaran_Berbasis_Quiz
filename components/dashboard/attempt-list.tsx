import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { fmtDateTime, fmtNum } from '@/lib/labels';
import type { MyAttempt } from '@/lib/dashboard';

export function AttemptList({ attempts }: { attempts: MyAttempt[] }) {
  if (!attempts.length) return <p className="text-sm text-muted-foreground">Belum ada kuis yang dikerjakan.</p>;
  return (
    <ul className="divide-y rounded-md border-[1.5px] font-heading text-sm">
      {attempts.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <span className="min-w-0"><b className="block truncate">{a.quizzes?.title ?? 'Kuis'}</b><span className="text-xs text-muted-foreground">{fmtDateTime(a.finished_at)}</span></span>
          <span className="flex items-center gap-3">
            {a.status === 'submitted' ? <Badge variant="outline">Menunggu penilaian</Badge>
              : <><b>{fmtNum(a.percent)}%</b>{a.passed ? <Badge>Lulus</Badge> : <Badge variant="secondary">Belum lulus</Badge>}</>}
            <Link href={`/attempts/${a.id}`}>Hasil</Link>
          </span>
        </li>
      ))}
    </ul>
  );
}
