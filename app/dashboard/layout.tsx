import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/site/page-parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard · KuisKelas' };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireUser('/dashboard');
  return (
    <div className="container-wide space-y-6 py-8 sm:py-10">
      <PageHeader eyebrow="Dashboard" title={`Halo, ${viewer.profile?.display_name || viewer.user?.email?.split('@')[0]}`} />
      <DashboardNav />
      {children}
    </div>
  );
}
