'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Pencil, Trash2, Upload, FileText, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseBrowser } from '@/lib/supabase/clients';

type CourseOpt = { id: string; title: string; slug: string };
type Material = {
  id: string; title: string; slug: string; status: string; display_order: number;
  course_id: string; preview_path: string | null; content_path: string | null;
  description: string | null; learning_objectives: string | null; material_tags: { tag: string }[];
  updated_at: string; courses: CourseOpt | null;
};

const BUCKET = 'materials';
/* Nama berkas aset: tanpa folder, tanpa karakter aneh, agar ./assets/<nama> di HTML cocok */
const assetName = (n: string) => n.split(/[\\/]/).pop()!.replace(/[^A-Za-z0-9._-]/g, '_');

function slugify(s: string) { return s.toLowerCase().trim().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'); }

export function MaterialsAdminClient({ materials, courses }: { materials: Material[]; courses: CourseOpt[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [courseId, setCourseId] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [tags, setTags] = useState('');

  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [assetFiles, setAssetFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const { toast } = useToast();
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  function reset() {
    setEditing(null); setTitle(''); setSlug(''); setCourseId(''); setDescription(''); setObjectives('');
    setStatus('draft'); setDisplayOrder(0); setTags(''); setPreviewFile(null); setContentFile(null); setAssetFiles([]);
  }
  function startCreate() { reset(); setOpen(true); }
  function startEdit(m: Material) {
    setEditing(m); setTitle(m.title); setSlug(m.slug); setCourseId(m.course_id);
    setDescription(m.description ?? ''); setObjectives(m.learning_objectives ?? '');
    setTags((m.material_tags ?? []).map((t) => t.tag).join(', '));
    setStatus(m.status as 'draft' | 'published' | 'archived'); setDisplayOrder(m.display_order);
    setOpen(true);
  }

  async function uploadFile(path: string, file: File): Promise<boolean> {
    const contentType = /\.html?$/i.test(file.name) ? 'text/html; charset=utf-8' : file.type || 'application/octet-stream';
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType });
    if (error) toast({ title: 'Upload failed', description: `${file.name}: ${error.message}`, variant: 'destructive' });
    return !error;
  }

  function fail(title: string, description?: string) {
    toast({ title, description, variant: 'destructive' });
    setSaving(false); setProgress(null);
  }

  /* Simpan data materi dulu (agar id tersedia), lalu unggah ke <id>/preview/ dan <id>/full/ di bucket privat. */
  async function save() {
    if (!title || !courseId) return fail('Title and course are required');
    setSaving(true);
    setProgress('Saving…');
    const payload = {
      course_id: courseId, title, slug: slug || slugify(title),
      description: description || null, learning_objectives: objectives || null,
      status, display_order: displayOrder,
    };
    let id: string;
    if (editing) {
      id = editing.id;
      const { error } = await supabase.from('materials').update(payload).eq('id', id);
      if (error) return fail('Update failed', error.message);
    } else {
      const { data, error } = await supabase.from('materials').insert(payload).select('id').single();
      if (error || !data) return fail('Create failed', error?.message);
      id = data.id;
    }

    const paths: { preview_path?: string; content_path?: string; content_assets?: string[] } = {};
    if (previewFile) {
      setProgress(`Uploading preview (${previewFile.name})…`);
      if (!(await uploadFile(`${id}/preview/index.html`, previewFile))) return fail('Upload failed');
      paths.preview_path = `${id}/preview`;
    }
    if (contentFile) {
      setProgress(`Uploading full content (${contentFile.name})…`);
      if (!(await uploadFile(`${id}/full/index.html`, contentFile))) return fail('Upload failed');
      paths.content_path = `${id}/full`;
    }
    if (assetFiles.length) {
      const names: string[] = [];
      for (const f of assetFiles) {
        setProgress(`Uploading asset (${f.name})…`);
        const n = assetName(f.name);
        if (!(await uploadFile(`${id}/full/assets/${n}`, f))) return fail('Upload failed');
        names.push(`assets/${n}`);
      }
      paths.content_assets = names;
    }
    if (Object.keys(paths).length) {
      const { error } = await supabase.from('materials').update(paths).eq('id', id);
      if (error) return fail('Saving file paths failed', error.message);
    }

    const tagList = Array.from(new Set(tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)));
    await supabase.from('material_tags').delete().eq('material_id', id);
    if (tagList.length) await supabase.from('material_tags').insert(tagList.map((tag) => ({ material_id: id, tag })));

    toast({ title: editing ? 'Material updated' : 'Material created' });
    setSaving(false); setProgress(null); setOpen(false); reset();
    router.refresh();
  }

  async function remove(m: Material) {
    if (!confirm(`Delete material "${m.title}"? This removes its record. Uploaded files remain in storage.`)) return;
    const { error } = await supabase.from('materials').delete().eq('id', m.id);
    if (error) return toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Material deleted' });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button onClick={startCreate}><Plus className="mr-1 h-4 w-4" /> New material</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit material' : 'New material'}</DialogTitle>
              <DialogDescription>
                Upload a preview (shown to all visitors) and the full HTML (shown only to enrolled users). Both are stored privately and served by the reader after an access check. Reference assets in the full HTML as <code>./assets/name.ext</code>; the preview should be self-contained.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="t">Title</Label>
                  <Input id="t" value={title} onChange={(e) => { setTitle(e.target.value); if (!editing) setSlug(slugify(e.target.value)); }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s">Slug</Label>
                  <Input id="s" value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Course</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as 'draft' | 'published' | 'archived')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="o">Display order</Label>
                  <Input id="o" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="histogram, kontras" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="d">Description</Label>
                <Textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ob">Learning objectives (one per line)</Label>
                <Textarea id="ob" value={objectives} onChange={(e) => setObjectives(e.target.value)} rows={3} />
              </div>

              <div className="rounded-md border border-dashed border-border p-3">
                <div className="mb-2 text-sm font-medium">Public preview HTML</div>
                <p className="mb-2 text-xs text-muted-foreground">Shown to everyone. Replaces any existing preview for this material.</p>
                <Input type="file" accept=".html,.htm" onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)} />
              </div>

              <div className="rounded-md border border-dashed border-border p-3">
                <div className="mb-2 text-sm font-medium">Full protected HTML</div>
                <p className="mb-2 text-xs text-muted-foreground">Shown only to enrolled users and admins. Use <code>./assets/...</code> for relative assets.</p>
                <Input type="file" accept=".html,.htm" onChange={(e) => setContentFile(e.target.files?.[0] ?? null)} />
              </div>

              <div className="rounded-md border border-dashed border-border p-3">
                <div className="mb-2 text-sm font-medium">Assets (images, css, js, etc.)</div>
                <p className="mb-2 text-xs text-muted-foreground">Saved as <code>./assets/&lt;file name&gt;</code> next to the full HTML. Multiple files allowed.</p>
                <Input type="file" multiple onChange={(e) => setAssetFiles(Array.from(e.target.files ?? []))} />
              </div>

              {progress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {progress}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving || !title || !courseId}>
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {editing ? 'Save changes' : 'Create material'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {materials.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No materials yet. Create your first material.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {materials.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    <span className="text-xs text-muted-foreground">{m.courses?.title ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">· {m.status}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{m.slug}</span>
                    {m.preview_path && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> preview</span>}
                    {m.content_path && <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3" /> full</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(m)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(m)} className="text-destructive"><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}