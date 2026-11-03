import { AttemptList } from '@/components/dashboard/attempt-list';
import { requireUser } from '@/lib/auth';
import { myAttempts } from '@/lib/dashboard';

/** FR-05/62: riwayat kuis pengguna terdaftar */
export default async function HistoryPage() {
  const { user } = await requireUser('/dashboard/history');
  const attempts = await myAttempts(user!.id);
  return <AttemptList attempts={attempts} />;
}
