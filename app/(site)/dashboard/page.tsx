import Link from 'next/link';
import { ArrowRight, BadgeCheck, ClipboardList, Crown, Hourglass, Radio, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttemptList } from '@/components/dashboard/attempt-list';
import { requireUser } from '@/lib/auth';
import { myAttempts } from '@/lib/dashboard';
import { getSubscriptionState } from '@/lib/subscriptions';
import { daysLeft } from '@/lib/access';
import { fmtDate, fmtNum } from '@/lib/labels';

/** FR-61: ringkasan aktivitas belajar */
export default async function DashboardPage() {
  const { user } = await requireUser('/dashboard');
  const [{ active, pending }, attempts] = await Promise.all([getSubscriptionState(), myAttempts(user!.id)]);
  const graded = attempts.filter((a) => a.status === 'graded');
  const avg = graded.length ? graded.reduce((t, a) => t + Number(a.percent), 0) / graded.length : null;
  const passed = graded.filter((a) => a.passed).length;
  const left = active ? daysLeft(active.expires_at) : null;
  const stats = [
    { label: 'Langganan', value: active ? 'Aktif' : pending ? 'Menunggu' : 'Belum', icon: Crown },
    { label: 'Kuis dikerjakan', value: attempts.length, icon: ClipboardList },
    { label: 'Rata-rata skor', value: avg == null ? '–' : `${fmtNum(avg)}%`, icon: Trophy },
    { label: 'Lulus', value: graded.length ? `${passed}/${graded.length}` : '–', icon: Trophy },
  ];
  return (
    <div className="space-y-6">
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
          <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Langganan</CardTitle><Link href="/dashboard/subscription" className="font-heading text-sm">Kelola</Link></CardHeader>
          <CardContent className="space-y-3">
            <p className="flex items-start gap-2 font-heading text-sm">
              {active ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : pending ? <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Crown className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
              <span>
                {active
                  ? active.expires_at ? `Aktif hingga ${fmtDate(active.expires_at)} (${left} hari lagi).` : 'Aktif tanpa batas waktu.'
                  : pending ? `Pengajuanmu (${fmtDate(pending.created_at)}) sedang ditinjau admin.` : 'Belum berlangganan. Materi berlabel Langganan baru bisa dibaca pratinjaunya.'}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {!active && !pending && <Button asChild size="sm"><Link href="/dashboard/subscription">Ajukan langganan</Link></Button>}
              <Button asChild size="sm" variant="outline"><Link href="/courses">Jelajahi materi <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
            </div>
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
