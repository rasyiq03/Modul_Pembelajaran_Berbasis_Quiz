import Link from 'next/link';
import { ArrowRight, Clock, Gamepad2, Layers, Lock, Radio, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ACCESS_LEVEL_LABEL, QUIZ_MODE_LABEL } from '@/lib/labels';
import type { AccessLevel, QuizMode } from '@/lib/database.types';

export type PublicQuiz = {
  id: string; title: string; description: string | null; mode: QuizMode; allow_guests: boolean;
  time_limit_sec: number | null; attempts_allowed: number | null; question_count: number;
  /** Tingkat akses efektif kuis mandiri, dan apakah penonton saat ini boleh mengerjakannya */
  access_level: AccessLevel; can_take: boolean;
  /** Soal yang bisa dimainkan di Arena (pilihan tunggal & benar/salah) */
  arena_count: number;
  materials: { title: string; slug: string; course_slug: string }[];
};

export function QuizCard({ q }: { q: PublicQuiz }) {
  const live = q.mode === 'live_competition';
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{QUIZ_MODE_LABEL[q.mode]}</Badge>
          {q.materials.length > 1 && (
            <Badge variant="outline"><Layers className="mr-1 h-3 w-3" /> {q.materials.length} materi</Badge>
          )}
          {!live && q.access_level !== 'public' && (
            <Badge variant="outline">{!q.can_take && <Lock className="mr-1 h-3 w-3" />}{ACCESS_LEVEL_LABEL[q.access_level]}</Badge>
          )}
          {q.allow_guests && !live && q.access_level === 'public' && <Badge variant="outline"><Users className="mr-1 h-3 w-3" /> Tamu boleh</Badge>}
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
          <p className="line-clamp-2">
            {q.materials.length > 1 ? `Campuran ${q.materials.length} materi: ` : 'Materi: '}
            {q.materials.map((m) => m.title).join(', ')}
          </p>
        )}
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap gap-2">
        {live ? (
          <Button asChild variant="outline" size="sm"><Link href="/join"><Radio className="mr-1 h-4 w-4" /> Gabung lewat kode sesi</Link></Button>
        ) : (
          <Button asChild size="sm" variant={q.can_take ? 'default' : 'outline'}>
            <Link href={`/quizzes/${q.id}`}>{q.can_take ? <>Kerjakan <ArrowRight className="ml-1 h-4 w-4" /></> : <><Lock className="mr-1 h-4 w-4" /> Lihat kuis</>}</Link>
          </Button>
        )}
        {q.arena_count > 0 && (
          <Button asChild size="sm" className="arena-btn"><Link href={`/arena/quiz/${q.id}`}><Gamepad2 className="mr-1 h-4 w-4" /> Arena</Link></Button>
        )}
      </CardFooter>
    </Card>
  );
}
