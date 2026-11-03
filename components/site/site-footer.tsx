import Link from 'next/link';
import { BrandMark } from '@/components/site/brand-mark';

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t-2 border-ink">
      <div className="container-wide flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="font-heading text-base font-extrabold text-foreground">Cognify</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-4 font-heading font-bold" aria-label="Tautan footer">
          <Link href="/courses" className="text-muted-foreground no-underline hover:text-foreground hover:underline">Mata Kuliah</Link>
          <Link href="/materials" className="text-muted-foreground no-underline hover:text-foreground hover:underline">Materi</Link>
          <Link href="/quizzes" className="text-muted-foreground no-underline hover:text-foreground hover:underline">Kuis</Link>
          <Link href="/join" className="text-muted-foreground no-underline hover:text-foreground hover:underline">Gabung Kuis</Link>
        </nav>
        <div className="text-xs">Modul pembelajaran interaktif berbasis kuis.</div>
      </div>
    </footer>
  );
}
