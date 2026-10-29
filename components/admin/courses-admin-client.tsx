'use client';

import { useState } from 'react';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_LABEL } from '@/lib/labels';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { useRouter } from 'next/navigation';

type Course = {
  id: string; title: string; slug: string; description: string | null;
  status: string; display_order: number; created_at: string; updated_at: string;
};

function slugify(s: string) { return s.toLowerCase().trim().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'); }

export function CoursesAdminClient({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  function reset() {
    setEditing(null); setTitle(''); setSlug(''); setDescription(''); setStatus('draft'); setDisplayOrder(0);
  }
  function startCreate() { reset(); setOpen(true); }
  function startEdit(c: Course) {
    setEditing(c); setTitle(c.title); setSlug(c.slug); setDescription(c.description ?? '');
    setStatus(c.status as 'draft' | 'published' | 'archived'); setDisplayOrder(c.display_order); setOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = { title, slug: slug || slugify(title), description, status, display_order: displayOrder };
    if (editing) {
      const { error } = await supabase.from('courses').update(payload).eq('id', editing.id);
      setSaving(false);
      if (error) return toast({ title: 'Gagal memperbarui', description: error.message, variant: 'destructive' });
      toast({ title: 'Mata kuliah diperbarui' });
    } else {
      const { error } = await supabase.from('courses').insert(payload);
      setSaving(false);
      if (error) return toast({ title: 'Gagal membuat', description: error.message, variant: 'destructive' });
      toast({ title: 'Mata kuliah dibuat' });
    }
    setOpen(false); reset(); router.refresh();
  }

  async function remove(c: Course) {
    if (!confirm(`Hapus mata kuliah "${c.title}"? Semua materinya ikut terhapus.`)) return;
    const { error } = await supabase.from('courses').delete().eq('id', c.id);
    if (error) return toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    toast({ title: 'Mata kuliah dihapus' });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button onClick={startCreate}><Plus className="mr-1 h-4 w-4" /> Mata kuliah baru</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Ubah mata kuliah' : 'Mata kuliah baru'}</DialogTitle>
              <DialogDescription>{editing ? 'Perbarui detail mata kuliah.' : 'Tambahkan mata kuliah baru ke katalog.'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="t">Judul</Label>
                <Input id="t" value={title} onChange={(e) => { setTitle(e.target.value); if (!editing) setSlug(slugify(e.target.value)); }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s">Slug</Label>
                <Input id="s" value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d">Deskripsi</Label>
                <Textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as 'draft' | 'published' | 'archived')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draf</SelectItem>
                      <SelectItem value="published">Terpublikasi</SelectItem>
                      <SelectItem value="archived">Diarsipkan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o">Urutan tampil</Label>
                  <Input id="o" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={save} disabled={saving || !title}>
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {editing ? 'Simpan perubahan' : 'Buat mata kuliah'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {courses.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Belum ada mata kuliah. Buat yang pertama, atau jalankan <code>npm run content:import</code>.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{c.title}</CardTitle>
                  <span className="text-xs text-muted-foreground">{STATUS_LABEL[c.status as keyof typeof STATUS_LABEL] ?? c.status}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground">{c.slug}</p>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">{c.description}</CardContent>
              <CardContent className="flex gap-2 pt-0">
                <Button size="sm" variant="outline" onClick={() => startEdit(c)}><Pencil className="mr-1 h-3.5 w-3.5" /> Ubah</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c)} className="text-destructive"><Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}