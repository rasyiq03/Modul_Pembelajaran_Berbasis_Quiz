import { AttemptList } from '@/components/dashboard/attempt-list';
import { getViewer } from '@/lib/auth';
import { myAttempts } from '@/lib/dashboard';

/** FR-05/62: riwayat kuis pengguna terdaftar */
export default async function HistoryPage() {
  const { user } = await getViewer();
  const attempts = await myAttempts(user!.id);
  return <AttemptList attempts={attempts} />;
}
