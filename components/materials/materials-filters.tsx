'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function MaterialsFilters({ courses }: { courses: { id: string; title: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [, startTransition] = useTransition();

  /* Filter baru selalu kembali ke halaman 1 */
  function apply(next: URLSearchParams) {
    next.delete('page');
    startTransition(() => router.replace(`/materials?${next.toString()}`));
  }

  useEffect(() => {
    if (q === (params.get('q') ?? '')) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set('q', q); else next.delete('q');
      apply(next);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari materi…"
          aria-label="Cari materi"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Select
        value={params.get('courseId') ?? 'all'}
        onValueChange={(v) => {
          const next = new URLSearchParams(params.toString());
          if (v && v !== 'all') next.set('courseId', v); else next.delete('courseId');
          apply(next);
        }}
      >
        <SelectTrigger className="w-full sm:w-60"><SelectValue placeholder="Semua mata kuliah" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua mata kuliah</SelectItem>
          {courses.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={params.get('sort') ?? 'newest'}
        onValueChange={(v) => {
          const next = new URLSearchParams(params.toString());
          next.set('sort', v);
          apply(next);
        }}
      >
        <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Terbaru</SelectItem>
          <SelectItem value="title">Judul (A–Z)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}