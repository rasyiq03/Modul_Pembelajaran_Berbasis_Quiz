import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdmin } from '@/lib/auth';
import { pendingSubscriptionCount } from '@/lib/admin/queries';

export const metadata = { title: 'Admin · StudyStudio' };
export const dynamic = 'force-dynamic';

/* Gerbang admin di server: halaman di bawah /admin tidak dirender sama sekali untuk non-admin. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminShell pendingSubscriptions={await pendingSubscriptionCount()}>{children}</AdminShell>;
}
