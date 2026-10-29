import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'Admin · KuisKelas' };
export const dynamic = 'force-dynamic';

/* Gerbang admin di server: halaman di bawah /admin tidak dirender sama sekali untuk non-admin. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
