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
import { STATUS_LABEL } from '@/lib/labels';
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
    if (error) toast({ title: 'Gagal mengunggah', description: `${file.name}: ${error.message}`, variant: 'destructive' });
    return !error;
  }

  function fail(title: string, description?: string) {
    toast({ title, description, variant: 'destructive' });
    setSaving(false); setProgress(null);
  }

  /* Simpan data materi dulu (agar id tersedia), lalu unggah ke <id>/preview/ dan <id>/full/ di bucket privat. */
  async function save() {
    if (!title || !courseId) return fail('Judul dan mata kuliah wajib diisi');
    setSaving(true);
    setProgress('Menyimpan…');
    const payload = {
      course_id: courseId, title, slug: slug || slugify(title),
      description: description || null, learning_objectives: objectives || null,
      status, display_order: displayOrder,
    };
    let id: string;
    if (editing) {
      id = editing.id;
      const { error } = await supabase.from('materials').update(payload).eq('id', id);
      if (error) return fail('Gagal memperbarui', error.message);
    } else {
      const { data, error } = await supabase.from('materials').insert(payload).select('id').single();
      if (error || !data) return fail('Gagal membuat', error?.message);
      id = data.id;
    }

    const paths: { preview_path?: string; content_path?: string; content_assets?: string[] } = {};
    if (previewFile) {
      setProgress(`Mengunggah pratinjau (${previewFile.name})…`);
      if (!(await uploadFile(`${id}/preview/index.html`, previewFile))) return fail('Gagal mengunggah');
      paths.preview_path = `${id}/preview`;
    }
    if (contentFile) {
      setProgress(`Mengunggah materi lengkap (${contentFile.name})…`);
      if (!(await uploadFile(`${id}/full/index.html`, contentFile))) return fail('Gagal mengunggah');
      paths.content_path = `${id}/full`;
    }
    if (assetFiles.length) {
      const names: string[] = [];
      for (const f of assetFiles) {
        setProgress(`Mengunggah aset (${f.name})…`);
        const n = assetName(f.name);
        if (!(await uploadFile(`${id}/full/assets/${n}`, f))) return fail('Gagal mengunggah');
        names.push(`assets/${n}`);
      }
      paths.content_assets = names;
    }
    if (Object.keys(paths).length) {
      const { error } = await supabase.from('materials').update(paths).eq('id', id);
      if (error) return fail('Gagal menyimpan lokasi berkas', error.message);
    }

    const tagList = Array.from(new Set(tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)));
    await supabase.from('material_tags').delete().eq('material_id', id);
    if (tagList.length) await supabase.from('material_tags').insert(tagList.map((tag) => ({ material_id: id, tag })));

    toast({ title: editing ? 'Materi diperbarui' : 'Materi dibuat' });
    setSaving(false); setProgress(null); setOpen(false); reset();
    router.refresh();
  }

  async function remove(m: Material) {
    if (!confirm(`Hapus materi "${m.title}"? Data materi, enrollment, dan key-nya ikut terhapus; berkas di Storage tetap ada.`)) return;
    const { error } = await supabase.from('materials').delete().eq('id', m.id);
    if (error) return toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    toast({ title: 'Materi dihapus' });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button onClick={startCreate}><Plus className="mr-1 h-4 w-4" /> Materi baru</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? 'Ubah materi' : 'Materi baru'}</DialogTitle>
              <DialogDescription>
                Unggah pratinjau (untuk semua pengunjung) dan HTML lengkap (hanya untuk yang ter-enroll). Keduanya disimpan privat dan dilayani pembaca setelah pemeriksaan akses. Rujuk aset di HTML lengkap sebagai <code>./assets/nama.ext</code>; pratinjau sebaiknya mandiri. Materi dari repo diimpor otomatis lewat <code>npm run content:import</code>.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="t">Judul</Label>
                  <Input id="t" value={title} onChange={(e) => { setTitle(e.target.value); if (!editing) setSlug(slugify(e.target.value)); }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s">Slug</Label>
                  <Input id="s" value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Mata kuliah</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger><SelectValue placeholder="Pilih mata kuliah" /></SelectTrigger>
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
                      <SelectItem value="draft">Draf</SelectItem>
                      <SelectItem value="published">Terpublikasi</SelectItem>
                      <SelectItem value="archived">Diarsipkan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="o">Urutan tampil</Label>
                  <Input id="o" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tag (pisahkan dengan koma)</Label>
                  <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="histogram, kontras" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="d">Deskripsi</Label>
                <Textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ob">Tujuan pembelajaran (satu per baris)</Label>
                <Textarea id="ob" value={objectives} onChange={(e) => setObjectives(e.target.value)} rows={3} />
              </div>

              <div className="rounded-md border border-dashed border-border p-3">
                <div className="mb-2 text-sm font-medium">HTML pratinjau publik</div>
                <p className="mb-2 text-xs text-muted-foreground">Tampil untuk semua orang. Menggantikan pratinjau yang sudah ada.</p>
                <Input type="file" accept=".html,.htm" onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)} />
              </div>

              <div className="rounded-md border border-dashed border-border p-3">
                <div className="mb-2 text-sm font-medium">HTML lengkap (terlindungi)</div>
                <p className="mb-2 text-xs text-muted-foreground">Hanya untuk pengguna ter-enroll dan admin. Gunakan <code>./assets/...</code> untuk aset relatif.</p>
                <Input type="file" accept=".html,.htm" onChange={(e) => setContentFile(e.target.files?.[0] ?? null)} />
              </div>

              <div className="rounded-md border border-dashed border-border p-3">
                <div className="mb-2 text-sm font-medium">Aset (gambar, css, js, dll.)</div>
                <p className="mb-2 text-xs text-muted-foreground">Disimpan sebagai <code>./assets/&lt;nama berkas&gt;</code> di samping HTML lengkap. Boleh beberapa berkas.</p>
                <Input type="file" multiple onChange={(e) => setAssetFiles(Array.from(e.target.files ?? []))} />
              </div>

              {progress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {progress}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={save} disabled={saving || !title || !courseId}>
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {editing ? 'Simpan perubahan' : 'Buat materi'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {materials.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Belum ada materi. Buat materi pertama, atau jalankan <code>npm run content:import</code>.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {materials.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    <span className="text-xs text-muted-foreground">{m.courses?.title ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">· {STATUS_LABEL[m.status as keyof typeof STATUS_LABEL] ?? m.status}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{m.slug}</span>
                    {m.preview_path && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> pratinjau</span>}
                    {m.content_path && <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3" /> lengkap</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(m)}><Pencil className="mr-1 h-3.5 w-3.5" /> Ubah</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(m)} className="text-destructive"><Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}