import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/site/page-parts';
import { RoleToggle } from '@/components/admin/role-toggle';
import { getViewer, requireAdmin } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { QueryFilterDSL } from '@/lib/dsl/query/filter';
import { SUBSCRIPTION_STATUS_LABEL, fmtDate } from '@/lib/labels';
import { effectiveStatus } from '@/lib/access';
import type { SubscriptionStatus } from '@/lib/database.types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pengguna · Admin' };

export default async function AdminUsersPage(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  await requireAdmin('/admin/users');
  const viewer = await getViewer();
  let q = createSupabaseServer().from('profiles').select('id, email, display_name, role, created_at, subscriptions(status, expires_at, created_at)').order('created_at', { ascending: false }).limit(500);
  const filter = QueryFilterDSL.orIlike(['email', 'display_name'], searchParams.q);
  if (filter) q = q.or(filter);
  const { data } = await q;
  const rows = (data ?? []) as unknown as { id: string; email: string | null; display_name: string | null; role: 'student' | 'admin'; created_at: string; subscriptions: { status: SubscriptionStatus; expires_at: string | null; created_at: string }[] }[];
  /* Status yang paling relevan: aktif > menunggu > pengajuan terbaru */
  const subLabel = (subs: (typeof rows)[number]['subscriptions']) => {
    const sorted = [...subs].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const active = sorted.find((x) => effectiveStatus(x) === 'active');
    if (active) return active.expires_at ? `Aktif s.d. ${fmtDate(active.expires_at)}` : 'Aktif';
    if (sorted.some((x) => x.status === 'pending')) return SUBSCRIPTION_STATUS_LABEL.pending;
    return sorted[0] ? SUBSCRIPTION_STATUS_LABEL[effectiveStatus(sorted[0])] : '–';
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Pengguna" description="Pengguna terdaftar dan perannya. Tamu kuis (login anonim) tidak punya akun dan tidak tampil di sini." />
      <form action="/admin/users" className="flex gap-2">
        <input name="q" defaultValue={searchParams.q} placeholder="Cari email atau nama" aria-label="Cari pengguna" className="h-10 w-full max-w-sm rounded-md border-[1.5px] border-input bg-background px-3 font-heading text-sm" />
      </form>
      <Card><CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Langganan</TableHead><TableHead>Terdaftar</TableHead><TableHead>Peran</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.display_name}</TableCell><TableCell>{u.email}</TableCell><TableCell className="whitespace-nowrap">{subLabel(u.subscriptions)}</TableCell>
                <TableCell>{fmtDate(u.created_at)}</TableCell>
                <TableCell><RoleToggle userId={u.id} role={u.role} self={u.id === viewer.user?.id} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
