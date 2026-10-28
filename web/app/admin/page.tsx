import Link from 'next/link';
import { ArrowRight, BookOpen, Boxes, ClipboardList, KeyRound, ListChecks, Radio, Trophy, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminStats, avgScore, recentAttempts } from '@/lib/admin/queries';
import { PageHeader, EmptyState } from '@/components/site/page-parts';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const [stats, avg, attempts] = await Promise.all([adminStats(), avgScore(), recentAttempts(8)]);
  const cards = [
    { label: 'Courses', value: stats.courses, icon: BookOpen, href: '/admin/courses' },
    { label: 'Published materials', value: stats.publishedMaterials, icon: Boxes, href: '/admin/materials' },
    { label: 'Published questions', value: stats.publishedQuestions, icon: ListChecks, href: '/admin/questions' },
    { label: 'Published quizzes', value: stats.publishedQuizzes, icon: ClipboardList, href: '/admin/quizzes' },
    { label: 'Active enrollments', value: stats.activeEnrollments, icon: Users, href: '/admin/keys' },
    { label: 'Graded attempts', value: stats.gradedAttempts, icon: TrendingUp, href: '/admin/results' },
    { label: 'Active sessions', value: stats.activeSessions, icon: Radio, href: '/admin/sessions' },
    { label: 'Participants', value: stats.participants, icon: Users, href: '/admin/sessions' },
    { label: 'Avg. score', value: `${avg}%`, icon: Trophy, href: '/admin/results' },
    { label: 'Enrollment keys', value: 'Manage', icon: KeyRound, href: '/admin/keys' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Real metrics from your database across courses, materials, quizzes, and sessions." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className="text-2xl font-semibold">{c.value}</div>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <c.icon className="h-5 w-5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent quiz attempts</CardTitle>
            <CardDescription>Latest graded/submitted attempts across all quizzes.</CardDescription>
          </div>
          <Button asChild variant="link" size="sm"><Link href="/admin/results">All results <ArrowRight className="h-4 w-4" /></Link></Button>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <EmptyState title="No attempts yet" description="Once learners take quizzes, attempts will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Percent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Finished</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.quizzes?.title ?? '—'}</TableCell>
                    <TableCell>{a.nickname ?? 'Signed in'}</TableCell>
                    <TableCell>{a.score}/{a.max_score}</TableCell>
                    <TableCell>{a.percent}%</TableCell>
                    <TableCell><Badge variant={a.status === 'graded' ? 'default' : 'secondary'}>{a.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.finished_at ? new Date(a.finished_at).toLocaleString() : '—'}</TableCell>
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