import { PageHeader } from '@/components/site/page-parts';
import { SubscriptionsAdmin, type SubscriptionTab } from '@/components/admin/subscriptions-admin';
import { adminListSubscriptions } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Langganan · Admin' };

export default async function AdminSubscriptionsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams;
  await requireAdmin('/admin/subscriptions');
  const rows = await adminListSubscriptions();
  const tab: SubscriptionTab = searchParams.tab === 'active' || searchParams.tab === 'history' ? searchParams.tab : 'pending';
  return (
    <div className="space-y-6">
      <PageHeader
        title="Langganan"
        description="Pengguna mengajukan langganan; setujui dengan masa berlaku, tolak, perpanjang, atau cabut. Tingkat akses tiap materi diatur di Admin → Materi."
      />
      <SubscriptionsAdmin rows={rows} initialTab={tab} />
    </div>
  );
}
