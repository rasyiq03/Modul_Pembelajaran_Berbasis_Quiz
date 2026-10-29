import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/site/page-parts';

export const metadata = { title: 'Halaman tidak ditemukan · KuisKelas' };

export default function NotFound() {
  return (
    <div className="container-page py-16">
      <EmptyState
        title="Halaman tidak ditemukan"
        description="Halaman yang kamu cari tidak ada, atau kamu tidak punya akses ke halaman ini."
        action={<Button asChild><Link href="/courses">Jelajahi mata kuliah</Link></Button>}
      />
    </div>
  );
}
