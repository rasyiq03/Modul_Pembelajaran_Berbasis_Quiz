'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage } from '@/lib/labels';

export function CancelSubscriptionRequest() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  async function cancel() {
    setBusy(true);
    const { error } = await getSupabaseBrowser().rpc('cancel_subscription_request');
    setBusy(false);
    if (error) return toast({ title: 'Gagal membatalkan', description: errorMessage(error), variant: 'destructive' });
    toast({ title: 'Pengajuan dibatalkan' });
    router.refresh();
  }
  return (
    <Button variant="outline" size="sm" onClick={cancel} disabled={busy}>
      {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Batalkan pengajuan
    </Button>
  );
}
