'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage } from '@/lib/labels';

/** FR-04: angkat/cabut peran admin (admin tidak bisa mencabut perannya sendiri) */
export function RoleToggle({ userId, role, self }: { userId: string; role: 'student' | 'admin'; self: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  async function toggle() {
    const next = role === 'admin' ? 'student' : 'admin';
    if (!confirm(next === 'admin' ? 'Jadikan pengguna ini admin?' : 'Cabut peran admin pengguna ini?')) return;
    const { error } = await getSupabaseBrowser().rpc('set_user_role', { p_user: userId, p_role: next });
    if (error) return toast({ title: 'Gagal', description: errorMessage(error), variant: 'destructive' });
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2">
      <Badge variant={role === 'admin' ? 'default' : 'secondary'}>{role === 'admin' ? 'Admin' : 'Mahasiswa'}</Badge>
      {!self && <Button size="sm" variant="ghost" onClick={toggle}>{role === 'admin' ? 'Cabut admin' : 'Jadikan admin'}</Button>}
    </div>
  );
}
