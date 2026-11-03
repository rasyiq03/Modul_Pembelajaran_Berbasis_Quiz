import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HostConsole } from '@/components/live/host-console';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Host sesi · StudyStudio' };

export default async function HostSessionPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireAdmin('/admin/sessions');
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm"><Link href="/admin/sessions"><ArrowLeft className="mr-1 h-4 w-4" /> Semua sesi</Link></Button>
      <HostConsole sessionId={params.id} />
    </div>
  );
}
