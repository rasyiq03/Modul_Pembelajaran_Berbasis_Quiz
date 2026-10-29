import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/site/page-parts';
import { QuestionEditor, type EditorQuestion } from '@/components/admin/question-editor';
import { createSupabaseServer } from '@/lib/supabase/server';
import { materialOptions } from '@/lib/admin/materials';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit soal · Admin' };

const EMPTY: EditorQuestion = {
  type: 'single_choice', prompt: '', media_url: null, topic: null, difficulty: null, status: 'draft',
  options: [], answer: {}, explanation: null, material_ids: [], tags: [],
};

export default async function QuestionPage({ params, searchParams }: { params: { id: string }; searchParams: { material?: string } }) {
  const materials = await materialOptions();
  let question: EditorQuestion = { ...EMPTY, material_ids: searchParams.material ? [searchParams.material] : [] };
  if (params.id !== 'new') {
    const supabase = createSupabaseServer();
    const { data: q } = await supabase
      .from('questions')
      .select('id, type, prompt, media_url, topic, difficulty, status, question_options(key, label, side, display_order), question_keys(answer, explanation), question_materials(material_id), question_tags(tag)')
      .eq('id', params.id).maybeSingle();
    if (!q) notFound();
    const r = q as unknown as {
      id: string; type: EditorQuestion['type']; prompt: string; media_url: string | null; topic: string | null; difficulty: string | null; status: EditorQuestion['status'];
      question_options: { key: string; label: string; side: 'left' | 'right' | null; display_order: number }[];
      question_keys: { answer: unknown; explanation: string | null } | null;
      question_materials: { material_id: string }[]; question_tags: { tag: string }[];
    };
    question = {
      id: r.id, type: r.type, prompt: r.prompt, media_url: r.media_url, topic: r.topic, difficulty: r.difficulty, status: r.status,
      options: [...r.question_options].sort((a, b) => a.display_order - b.display_order).map(({ key, label, side }) => ({ key, label, side })),
      answer: r.question_keys?.answer ?? {}, explanation: r.question_keys?.explanation ?? null,
      material_ids: r.question_materials.map((m) => m.material_id), tags: r.question_tags.map((t) => t.tag),
    };
  }
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm"><Link href="/admin/questions"><ArrowLeft className="mr-1 h-4 w-4" /> Bank soal</Link></Button>
      <PageHeader title={question.id ? 'Edit soal' : 'Soal baru'} description="Kunci jawaban dan pembahasan hanya bisa dilihat admin; peserta melihatnya sesuai pengaturan kuis." />
      <QuestionEditor question={question} materials={materials} />
    </div>
  );
}
