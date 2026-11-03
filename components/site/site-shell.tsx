import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';

/** Kerangka halaman situs: header, isi, footer */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Pengguna keyboard/pembaca layar bisa langsung melompati navigasi */}
      <a href="#konten" className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-heading text-sm font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Lewati ke konten
      </a>
      <SiteHeader />
      <main id="konten" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      <SiteFooter />
    </div>
  );
}
