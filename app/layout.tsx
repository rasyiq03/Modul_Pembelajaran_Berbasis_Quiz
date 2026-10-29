import './globals.css';
import type { Metadata } from 'next';
import { Montserrat, Source_Serif_4 } from 'next/font/google';
import { AuthProvider } from '@/lib/supabase/auth-provider';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { Toaster } from '@/components/ui/toaster';
import { XpProvider } from '@/components/gamification/xp-provider';

/* Huruf yang sama dengan materi: Montserrat untuk judul & kontrol, Source Serif 4 untuk bacaan */
const heading = Montserrat({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-head', display: 'swap' });
const body = Source_Serif_4({ subsets: ['latin'], weight: ['400', '600'], style: ['normal', 'italic'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'KuisKelas: Catatan Kuliah Interaktif',
  description: 'Materi kuliah interaktif, kuis mandiri, dan kuis live dengan kode sesi.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${heading.variable} ${body.variable}`}>
      <body>
        <AuthProvider>
          <XpProvider>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
            <Toaster />
          </XpProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
