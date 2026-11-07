import { AttemptList } from '@/components/dashboard/attempt-list';
import { ArenaRunList } from '@/components/dashboard/arena-run-list';
import { requireUser } from '@/lib/auth';
import { myArenaRuns, myAttempts } from '@/lib/dashboard';

/** FR-05/62: riwayat kuis mandiri dan permainan Arena pengguna terdaftar */
export default async function HistoryPage() {
  const { user } = await requireUser('/dashboard/history');
  const [attempts, runs] = await Promise.all([myAttempts(user!.id), myArenaRuns(user!.id)]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-2">
        <h2 className="text-lg">Kuis mandiri</h2>
        <AttemptList attempts={attempts} />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg">Arena</h2>
        <ArenaRunList runs={runs} />
      </section>
    </div>
  );
}
