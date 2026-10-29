import Link from 'next/link';
import { ArrowRight, Clock, Radio, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { QUIZ_MODE_LABEL } from '@/lib/labels';
import type { QuizMode } from '@/lib/database.types';

export type PublicQuiz = {
  id: string; title: string; description: string | null; mode: QuizMode; allow_guests: boolean;
  time_limit_sec: number | null; attempts_allowed: number | null; question_count: number;
  materials: { title: string; slug: string; course_slug: string }[];
};

export function QuizCard({ q }: { q: PublicQuiz }) {
  const live = q.mode === 'live_competition';
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{QUIZ_MODE_LABEL[q.mode]}</Badge>
          {q.allow_guests && !live && <Badge variant="outline"><Users className="mr-1 h-3 w-3" /> Tamu boleh</Badge>}
        </div>
        <CardTitle className="text-lg">{q.title}</CardTitle>
        {q.description && <CardDescription>{q.description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2 font-heading text-xs text-muted-foreground">
        <p>
          {q.question_count} soal
          {q.time_limit_sec ? <> · <Clock className="inline h-3 w-3" /> {Math.round(q.time_limit_sec / 60)} menit</> : null}
          {q.attempts_allowed ? <> · maks. {q.attempts_allowed}× percobaan</> : null}
        </p>
        {q.materials.length > 0 && (
          <p className="line-clamp-2">Materi: {q.materials.map((m) => m.title).join(', ')}</p>
        )}
      </CardContent>
      <CardFooter className="mt-auto">
        {live ? (
          <Button asChild variant="outline" size="sm"><Link href="/join"><Radio className="mr-1 h-4 w-4" /> Gabung lewat kode sesi</Link></Button>
        ) : (
          <Button asChild size="sm"><Link href={`/quizzes/${q.id}`}>Kerjakan <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        )}
      </CardFooter>
    </Card>
  );
}
