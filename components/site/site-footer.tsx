import Link from 'next/link';
import { BrandMark } from '@/components/site/brand-mark';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container-wide flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="font-medium text-foreground">KuisKelas</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-4" aria-label="Tautan footer">
          <Link href="/courses" className="hover:text-foreground">Mata Kuliah</Link>
          <Link href="/materials" className="hover:text-foreground">Materi</Link>
          <Link href="/quizzes" className="hover:text-foreground">Kuis</Link>
          <Link href="/join" className="hover:text-foreground">Gabung Kuis</Link>
        </nav>
        <div className="text-xs">Modul pembelajaran interaktif berbasis kuis.</div>
      </div>
    </footer>
  );
}
