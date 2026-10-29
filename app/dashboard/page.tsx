import Link from 'next/link';
import { ArrowRight, BookOpen, ClipboardList, Radio, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttemptList } from '@/components/dashboard/attempt-list';
import { getViewer } from '@/lib/auth';
import { myAttempts, myMaterials } from '@/lib/dashboard';
import { fmtNum } from '@/lib/labels';
import { getMyProgress } from '@/lib/gamification-server';
import { BadgeGrid, LevelCard } from '@/components/gamification/cards';

/** FR-61: ringkasan aktivitas belajar */
export default async function DashboardPage() {
  const { user, profile } = await getViewer();
  const [materials, attempts, progress] = await Promise.all([myMaterials(user!.id), myAttempts(user!.id), getMyProgress()]);
  const graded = attempts.filter((a) => a.status === 'graded');
  const avg = graded.length ? graded.reduce((t, a) => t + Number(a.percent), 0) / graded.length : null;
  const passed = graded.filter((a) => a.passed).length;
  const stats = [
    { label: 'Materi dibuka', value: materials.length, icon: BookOpen },
    { label: 'Kuis dikerjakan', value: attempts.length, icon: ClipboardList },
    { label: 'Rata-rata skor', value: avg == null ? '–' : `${fmtNum(avg)}%`, icon: Trophy },
    { label: 'Lulus', value: graded.length ? `${passed}/${graded.length}` : '–', icon: Trophy },
  ];
  return (
    <div className="space-y-6">
      {progress && (
        <>
          <LevelCard progress={progress} avatar={profile?.avatar ?? '🦉'} name={profile?.display_name || user!.email!.split('@')[0]} />
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Lencana terbaru</CardTitle><Link href="/dashboard/achievements" className="font-heading text-sm">Semua pencapaian</Link></CardHeader>
            <CardContent><BadgeGrid earned={progress.badges} compact /></CardContent>
          </Card>
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}><CardContent className="flex items-center justify-between p-4">
            <div><div className="font-heading text-xs font-bold text-muted-foreground">{s.label}</div><div className="font-heading text-2xl font-extrabold">{s.value}</div></div>
            <span className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-primary"><s.icon className="h-5 w-5" /></span>
          </CardContent></Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Materi terakhir dibuka</CardTitle><Link href="/dashboard/materials" className="font-heading text-sm">Semua</Link></CardHeader>
          <CardContent className="space-y-2">
            {materials.length === 0 && <p className="text-sm text-muted-foreground">Belum ada. Buka materi lalu masukkan enrollment key dari pengajar.</p>}
            {materials.slice(0, 5).map((e) => (
              <Link key={e.id} href={`/courses/${e.materials!.courses?.slug}/${e.materials!.slug}`} className="flex items-center justify-between rounded-md border-[1.5px] px-3 py-2 font-heading text-sm text-foreground no-underline hover:border-primary">
                <span><b>{e.materials!.title}</b><span className="block text-xs text-muted-foreground">{e.materials!.courses?.title}</span></span><ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Kuis terakhir</CardTitle><Link href="/dashboard/history" className="font-heading text-sm">Riwayat</Link></CardHeader>
          <CardContent><AttemptList attempts={attempts.slice(0, 5)} /></CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild><Link href="/quizzes">Cari kuis</Link></Button>
        <Button asChild variant="outline"><Link href="/join"><Radio className="mr-1 h-4 w-4" /> Gabung sesi live</Link></Button>
      </div>
    </div>
  );
}
