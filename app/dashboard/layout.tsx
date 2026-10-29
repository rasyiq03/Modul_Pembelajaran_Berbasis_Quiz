import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard · KuisKelas' };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireUser('/dashboard');
  return (
    <div className="container-wide space-y-6 py-8">
      <header className="space-y-1">
        <p className="eyebrow">Dashboard</p>
        <h1 className="text-[clamp(1.6rem,4vw,2.4rem)]">Halo, {viewer.profile?.display_name || viewer.user?.email?.split('@')[0]}</h1>
      </header>
      <DashboardNav />
      {children}
    </div>
  );
}
