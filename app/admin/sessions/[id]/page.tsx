import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HostConsole } from '@/components/live/host-console';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Host sesi · KuisKelas' };

export default function HostSessionPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm"><Link href="/admin/sessions"><ArrowLeft className="mr-1 h-4 w-4" /> Semua sesi</Link></Button>
      <HostConsole sessionId={params.id} />
    </div>
  );
}
