import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgeGrid, LevelCard, XpHistory, XpRules } from '@/components/gamification/cards';
import { getViewer } from '@/lib/auth';
import { getMyProgress } from '@/lib/gamification-server';
import { BADGES } from '@/lib/gamification';

export const metadata = { title: 'Pencapaian · KuisKelas' };

/** XP, level, lencana, dan riwayat XP pengguna (dulu hanya ada di localStorage materi) */
export default async function AchievementsPage() {
  const { user, profile } = await getViewer();
  const progress = await getMyProgress();
  if (!progress) return <p className="text-sm text-muted-foreground">Data pencapaian belum tersedia.</p>;
  return (
    <div className="space-y-6">
      <LevelCard progress={progress} avatar={profile?.avatar ?? '🦉'} name={profile?.display_name || user!.email!.split('@')[0]} />
      <Card>
        <CardHeader><CardTitle className="text-lg">Lencana {progress.badges.length}/{BADGES.length}</CardTitle></CardHeader>
        <CardContent><BadgeGrid earned={progress.badges} /></CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle className="text-lg">Riwayat XP terbaru</CardTitle></CardHeader>
          <CardContent><XpHistory events={progress.recent} /></CardContent>
        </Card>
        <div><XpRules /></div>
      </div>
    </div>
  );
}
