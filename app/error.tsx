'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/site/page-parts';
import { SiteShell } from '@/components/site/site-shell';

/* Batas error untuk semua halaman: pengguna melihat pesan dan tombol coba lagi, bukan layar
   "Application error" bawaan. Detail error hanya di log (production menyembunyikan pesannya).
   Menggantikan layout situs, jadi seperti not-found membawa header & footer sendiri. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <SiteShell>
      <div className="container-page py-16">
        <EmptyState
          title="Terjadi kesalahan"
          description={`Halaman ini gagal dimuat. Coba lagi sebentar lagi.${error.digest ? ` (Kode: ${error.digest})` : ''}`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={reset}>Coba lagi</Button>
              <Button asChild variant="outline"><Link href="/">Ke beranda</Link></Button>
            </div>
          }
        />
      </div>
    </SiteShell>
  );
}
