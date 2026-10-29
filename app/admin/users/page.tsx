import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/site/page-parts';
import { RoleToggle } from '@/components/admin/role-toggle';
import { getViewer } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { fmtDate } from '@/lib/labels';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pengguna · Admin' };

export default async function AdminUsersPage({ searchParams }: { searchParams: { q?: string } }) {
  const viewer = await getViewer();
  let q = createSupabaseServer().from('profiles').select('id, email, display_name, role, created_at, enrollments(id)').order('created_at', { ascending: false }).limit(500);
  if (searchParams.q) q = q.or(`email.ilike.%${searchParams.q.replace(/[%_,()]/g, '')}%,display_name.ilike.%${searchParams.q.replace(/[%_,()]/g, '')}%`);
  const { data } = await q;
  const rows = (data ?? []) as unknown as { id: string; email: string | null; display_name: string | null; role: 'student' | 'admin'; created_at: string; enrollments: { id: string }[] }[];
  return (
    <div className="space-y-6">
      <PageHeader title="Pengguna" description="Pengguna terdaftar dan perannya. Tamu kuis (login anonim) tidak punya akun dan tidak tampil di sini." />
      <form action="/admin/users" className="flex gap-2">
        <input name="q" defaultValue={searchParams.q} placeholder="Cari email atau nama" aria-label="Cari pengguna" className="h-10 w-full max-w-sm rounded-md border-[1.5px] border-input bg-background px-3 font-heading text-sm" />
      </form>
      <Card><CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Materi dibuka</TableHead><TableHead>Terdaftar</TableHead><TableHead>Peran</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.display_name}</TableCell><TableCell>{u.email}</TableCell><TableCell>{u.enrollments.length}</TableCell>
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
