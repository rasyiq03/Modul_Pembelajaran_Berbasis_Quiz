import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/site/page-parts';
import { SiteShell } from '@/components/site/site-shell';

export const metadata = { title: 'Halaman tidak ditemukan · StudyStudio' };

/* Dirender di bawah layout root (tanpa layout situs), jadi membawa header & footer sendiri */
export default function NotFound() {
  return (
    <SiteShell>
      <div className="container-page py-16">
        <EmptyState
          title="Halaman tidak ditemukan"
          description="Halaman yang kamu cari tidak ada, atau kamu tidak punya akses ke halaman ini."
          action={<Button asChild><Link href="/courses">Jelajahi mata kuliah</Link></Button>}
        />
      </div>
    </SiteShell>
  );
}
