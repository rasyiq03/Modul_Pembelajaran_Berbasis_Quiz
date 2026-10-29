import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/site/page-parts';
import { QuizEditor, type BankQuestion, type EditorQuiz } from '@/components/admin/quiz-editor';
import { createSupabaseServer } from '@/lib/supabase/server';
import { materialOptions } from '@/lib/admin/materials';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Penyusun kuis · Admin' };

export default async function QuizEditPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServer();
  const [materials, { data: bankRows }] = await Promise.all([
    materialOptions(),
    supabase.from('questions').select('id, type, prompt, status, topic, question_materials(material_id)').neq('status', 'archived').order('created_at').limit(5000),
  ]);
  const bank: BankQuestion[] = ((bankRows ?? []) as unknown as (Omit<BankQuestion, 'material_ids'> & { question_materials: { material_id: string }[] })[])
    .map(({ question_materials, ...b }) => ({ ...b, material_ids: question_materials.map((m) => m.material_id) }));

  let quiz: EditorQuiz = { title: '', description: null, mode: 'self_paced', status: 'draft', settings: { allow_guests: true, show_feedback: 'after_submit', pass_threshold: 60 }, questions: [] };
  if (params.id !== 'new') {
    const { data } = await supabase.from('quizzes').select('id, title, description, mode, status, settings, quiz_questions(question_id, points, display_order)').eq('id', params.id).maybeSingle();
    if (!data) notFound();
    const r = data as unknown as EditorQuiz & { quiz_questions: { question_id: string; points: number; display_order: number }[] };
    /* Soal yang sudah diarsipkan tetap tampil di kuis yang memakainya */
    const missing = r.quiz_questions.filter((q) => !bank.some((b) => b.id === q.question_id)).map((q) => q.question_id);
    if (missing.length) {
      const { data: extra } = await supabase.from('questions').select('id, type, prompt, status, topic').in('id', missing);
      (extra ?? []).forEach((e) => bank.push({ ...(e as Omit<BankQuestion, 'material_ids'>), material_ids: [] }));
    }
    quiz = {
      id: r.id, title: r.title, description: r.description, mode: r.mode, status: r.status, settings: r.settings ?? {},
      questions: [...r.quiz_questions].sort((a, b) => a.display_order - b.display_order).map(({ question_id, points }) => ({ question_id, points: Number(points) })),
    };
  }
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm"><Link href="/admin/quizzes"><ArrowLeft className="mr-1 h-4 w-4" /> Semua kuis</Link></Button>
      <PageHeader title={quiz.id ? quiz.title || 'Edit kuis' : 'Kuis baru'} description="Ambil soal dari bank soal, satu atau beberapa materi sekaligus. Setiap soal tetap satu salinan kanonis." />
      <QuizEditor quiz={quiz} bank={bank} materials={materials} />
    </div>
  );
}
