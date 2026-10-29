'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { csvObjects, toCsv } from '@/lib/csv';
import { CSV_COLUMNS, rowToQuestion } from '@/lib/question-csv';
import { errorMessage } from '@/lib/labels';

const TEMPLATE = [
  [...CSV_COLUMNS],
  ['', 'single_choice', 'Citra biner memiliki berapa nilai piksel?', 'A: 1 | B: 2 | C: 256 | D: tak terbatas', 'B', 'Hanya 0 dan 1.', 'citra biner', 'easy', 'published', '', 'biner', ''],
  ['', 'true_false', 'Ekualisasi histogram meratakan sebaran intensitas.', '', 'benar', '', 'histogram', 'medium', 'draft', '', '', ''],
  ['', 'ordering', 'Urutkan tahap design thinking.', 'A: Empathize | B: Define | C: Ideate', 'A, B, C', '', '', '', 'draft', '', '', ''],
];

/** FR-34: impor soal dari CSV. Baris yang gagal dilaporkan per nomor baris tanpa membatalkan yang lain. */
export function QuestionImport({ materials }: { materials: { id: string; ref: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ saved: number; errors: { row: number; message: string }[] } | null>(null);

  async function onFile(f: File) {
    setBusy(true); setReport(null);
    const map = new Map(materials.map((m) => [m.ref.toLowerCase(), m.id]));
    const rows = csvObjects(await f.text());
    const errors: { row: number; message: string }[] = [];
    const payload: unknown[] = [];
    const index: number[] = [];
    rows.forEach((r, i) => {
      try { payload.push(rowToQuestion(r, map)); index.push(i + 2); }
      catch (e) { errors.push({ row: i + 2, message: (e as Error).message }); }
    });
    let saved = 0;
    if (payload.length) {
      const { data, error } = await getSupabaseBrowser().rpc('admin_import_questions', { p_rows: payload });
      if (error) errors.push({ row: 0, message: errorMessage(error) });
      else {
        saved = data.saved;
        data.errors.forEach((e) => errors.push({ row: index[e.row - 1], message: errorMessage(e.message) }));
      }
    }
    setReport({ saved, errors: errors.sort((a, b) => a.row - b.row) });
    setBusy(false);
    router.refresh();
  }

  function template() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCsv(TEMPLATE)], { type: 'text/csv;charset=utf-8' }));
    a.download = 'templat-bank-soal.csv'; a.click();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setReport(null); }}>
      <DialogTrigger asChild><Button variant="outline"><Upload className="mr-1 h-4 w-4" /> Impor CSV</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Impor soal dari CSV</DialogTitle>
          <DialogDescription>
            Kolom: {CSV_COLUMNS.join(', ')}. Baris dengan <code>source_ref</code> yang sudah ada memperbarui soal lama.
            Kolom <code>materials</code> memakai format <code>mata-kuliah/materi</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={template}>Unduh templat CSV</Button>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-[1.5px] border-dashed p-6 text-center font-heading text-sm">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            Pilih file .csv
            <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
          </label>
          {report && (
            <div className="space-y-2 text-sm" role="status">
              <p className="font-heading font-bold">{report.saved} soal tersimpan{report.errors.length ? `, ${report.errors.length} baris gagal` : ''}.</p>
              {report.errors.length > 0 && (
                <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-destructive">
                  {report.errors.map((e, i) => <li key={i}>{e.row ? `Baris ${e.row}: ` : ''}{e.message}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
