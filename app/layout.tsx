import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Source_Serif_4 } from 'next/font/google';
import { AuthProvider } from '@/lib/supabase/auth-provider';
import { Toaster } from '@/components/ui/toaster';

/* Bricolage Grotesque untuk judul & kontrol, Source Serif 4 (sama dengan materi) untuk bacaan */
const heading = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz'], variable: '--font-head', display: 'swap' });
const body = Source_Serif_4({ subsets: ['latin'], weight: ['400', '600'], style: ['normal', 'italic'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'StudyStudio: Catatan Kuliah Interaktif',
  description: 'Materi kuliah interaktif, kuis mandiri, dan kuis live dengan kode sesi.',
};

/* Warna bilah browser di ponsel mengikuti latar krem / gelap */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFF7E6' },
    { media: '(prefers-color-scheme: dark)', color: '#19160F' },
  ],
};

/* Header & footer situs ada di app/(site)/layout.tsx; pembaca materi (app/(reader)) tampil layar penuh tanpa keduanya */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${heading.variable} ${body.variable}`}>
      <body>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
