'use client';

import { useRouter } from 'next/navigation';
import { Archive, Copy, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage } from '@/lib/labels';

/** FR-32: duplikat, publikasi, dan arsip soal dari daftar bank soal */
export function QuestionRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = getSupabaseBrowser();

  async function duplicate() {
    const { data, error } = await supabase.rpc('admin_duplicate_question', { p_question: id });
    if (error) return toast({ title: 'Gagal menduplikat', description: errorMessage(error), variant: 'destructive' });
    router.push(`/admin/questions/${data}`);
  }
  async function setStatus(s: 'published' | 'archived' | 'draft') {
    const { error } = await supabase.from('questions').update({ status: s }).eq('id', id);
    if (error) return toast({ title: 'Gagal', description: errorMessage(error), variant: 'destructive' });
    router.refresh();
  }
  return (
    <div className="flex justify-end gap-1">
      {status !== 'published' && status !== 'archived' && <Button size="icon" variant="ghost" title="Publikasikan" aria-label="Publikasikan" onClick={() => setStatus('published')}><Send className="h-4 w-4" /></Button>}
      <Button size="icon" variant="ghost" title="Duplikat" aria-label="Duplikat" onClick={duplicate}><Copy className="h-4 w-4" /></Button>
      {status === 'archived'
        ? <Button size="sm" variant="ghost" onClick={() => setStatus('draft')}>Pulihkan</Button>
        : <Button size="icon" variant="ghost" title="Arsipkan" aria-label="Arsipkan" onClick={() => setStatus('archived')}><Archive className="h-4 w-4" /></Button>}
    </div>
  );
}
