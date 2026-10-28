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
        <div className="flex items-center gap-4">
          <Link href="/courses" className="hover:text-foreground">Courses</Link>
          <Link href="/materials" className="hover:text-foreground">Materials</Link>
          <Link href="/join" className="hover:text-foreground">Join a Quiz</Link>
        </div>
        <div className="text-xs">
          Built for university interactive learning.
        </div>
      </div>
    </footer>
  );
}