import { Card, CardContent } from '@/components/ui/card';
import { ProfileForm } from '@/components/dashboard/profile-form';
import { getViewer } from '@/lib/auth';
import { fmtDate } from '@/lib/labels';

/** FR-03: lihat & kelola profil */
export default async function ProfilePage() {
  const { profile, user } = await getViewer();
  return (
    <Card className="max-w-xl">
      <CardContent className="space-y-4 p-6">
        <dl className="grid grid-cols-[8rem_1fr] gap-2 font-heading text-sm">
          <dt className="text-muted-foreground">Email</dt><dd>{user?.email}</dd>
          <dt className="text-muted-foreground">Peran</dt><dd>{profile?.role === 'admin' ? 'Admin' : 'Mahasiswa'}</dd>
          <dt className="text-muted-foreground">Terdaftar</dt><dd>{fmtDate(profile?.created_at)}</dd>
        </dl>
        <ProfileForm userId={user!.id} displayName={profile?.display_name ?? ''} />
      </CardContent>
    </Card>
  );
}
