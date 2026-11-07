import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Source_Serif_4 } from 'next/font/google';
import { AuthProvider } from '@/lib/supabase/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import { THEME_SCRIPT } from '@/lib/theme-script';

/* Bricolage Grotesque untuk judul & kontrol, Source Serif 4 (sama dengan materi) untuk bacaan */
const heading = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz'], variable: '--font-head', display: 'swap' });
const body = Source_Serif_4({ subsets: ['latin'], weight: ['400', '600'], style: ['normal', 'italic'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'Cognify: Catatan Kuliah Interaktif',
  description: 'Materi kuliah interaktif, kuis mandiri, dan kuis live dengan kode sesi.',
};

/* Warna bilah browser di ponsel mengikuti latar krem / ungu gelap */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFF7E6' },
    { media: '(prefers-color-scheme: dark)', color: '#150B23' },
  ],
};

/* Header & footer situs ada di app/(site)/layout.tsx; pembaca materi (app/(reader)) tampil layar penuh tanpa keduanya.
   data-theme di <html> dipasang THEME_SCRIPT sebelum hidrasi, jadi atributnya boleh berbeda dari render server. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${heading.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
