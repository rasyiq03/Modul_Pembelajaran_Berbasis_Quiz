import Link from 'next/link';
import { BookOpen, Boxes, ClipboardList, KeyRound, ListChecks, Radio, Trophy, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, PageHeader } from '@/components/site/page-parts';
import { adminStats, avgScore, recentAttempts } from '@/lib/admin/queries';
import { fmtDateTime, fmtNum } from '@/lib/labels';

export const dynamic = 'force-dynamic';

/** FR-65: ringkasan materi, soal, kuis, enrollment, dan aktivitas */
export default async function AdminOverviewPage() {
  const [stats, avg, attempts] = await Promise.all([adminStats(), avgScore(), recentAttempts(8)]);
  const cards = [
    { label: 'Mata kuliah', value: stats.courses, icon: BookOpen, href: '/admin/courses' },
    { label: 'Materi terpublikasi', value: stats.publishedMaterials, icon: Boxes, href: '/admin/materials' },
    { label: 'Soal terpublikasi', value: stats.publishedQuestions, icon: ListChecks, href: '/admin/questions' },
    { label: 'Kuis terpublikasi', value: stats.publishedQuizzes, icon: ClipboardList, href: '/admin/quizzes' },
    { label: 'Enrollment aktif', value: stats.activeEnrollments, icon: KeyRound, href: '/admin/keys' },
    { label: 'Percobaan dinilai', value: stats.gradedAttempts, icon: TrendingUp, href: '/admin/results' },
    { label: 'Sesi live berjalan', value: stats.activeSessions, icon: Radio, href: '/admin/sessions' },
    { label: 'Peserta sesi live', value: stats.participants, icon: Users, href: '/admin/sessions' },
    { label: 'Rata-rata skor', value: `${fmtNum(avg)}%`, icon: Trophy, href: '/admin/results' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Ringkasan" description="Angka langsung dari database untuk materi, bank soal, kuis, enrollment, dan sesi live." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="block no-underline">
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="font-heading text-xs font-bold text-muted-foreground">{c.label}</div>
                  <div className="font-heading text-2xl font-extrabold text-foreground">{c.value}</div>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-primary"><c.icon className="h-5 w-5" /></span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Percobaan kuis terbaru</CardTitle>
          <CardDescription>Percobaan yang sudah dikirim dari semua kuis (tanpa pratinjau admin).</CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <EmptyState title="Belum ada percobaan" description="Percobaan peserta akan tampil di sini." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Kuis</TableHead><TableHead>Peserta</TableHead><TableHead>Skor</TableHead><TableHead>Status</TableHead><TableHead>Selesai</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.quizzes?.title ?? '–'}</TableCell>
                    <TableCell>{a.nickname ?? (a.is_guest ? 'Tamu' : 'Pengguna terdaftar')}</TableCell>
                    <TableCell>{fmtNum(a.score)}/{fmtNum(a.max_score)} ({fmtNum(a.percent)}%)</TableCell>
                    <TableCell><Badge variant={a.status === 'graded' ? 'default' : 'secondary'}>{a.status === 'graded' ? 'Dinilai' : 'Perlu dinilai'}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(a.finished_at)}</TableCell>
                    <TableCell><Link href={`/attempts/${a.id}`}>Detail</Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
