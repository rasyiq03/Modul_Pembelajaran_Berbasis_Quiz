import { PageHeader } from '@/components/site/page-parts';
import { KeysAdmin } from '@/components/admin/keys-admin';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enrollment key · Admin' };

export default async function AdminKeysPage() {
  const supabase = createSupabaseServer();
  const [{ data: keys }, { data: enrollments }, { data: materials }] = await Promise.all([
    supabase.from('enrollment_keys').select('id, key_prefix, material_id, expires_at, max_uses, uses_count, revoked, note, created_at, materials(title)').order('created_at', { ascending: false }),
    supabase.from('enrollments').select('id, user_id, material_id, source, revoked, revoked_at, created_at, materials(title), profiles(email, display_name)').order('created_at', { ascending: false }).limit(500),
    supabase.from('materials').select('id, title, status, courses(title)').neq('status', 'archived').order('title'),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Enrollment key" description="Satu key membuka satu materi. Mencabut key tidak mencabut akses yang sudah terbentuk; cabut aksesnya di tabel enrollment." />
      <KeysAdmin keys={(keys ?? []) as never} enrollments={(enrollments ?? []) as never} materials={(materials ?? []) as never} />
    </div>
  );
}
