import Link from 'next/link';
import { KeyRound, Lock, CheckCircle2, LogIn, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RedeemKey } from '@/components/materials/redeem-key';
import { MaterialFrame } from '@/components/materials/material-progress';


/** FR-15/16/20: pratinjau publik untuk semua, materi lengkap hanya untuk yang ter-enroll (atau admin) */
export function MaterialAccess({
  materialSlug,
  courseSlug,
  readerSrc,
  showing,
  hasAccess,
  accessReason,
  isRegistered,
}: {
  materialSlug: string;
  courseSlug: string;
  readerSrc: string | null;
  showing: 'full' | 'preview' | null;
  hasAccess: boolean;
  accessReason: 'enrolled' | 'admin' | 'none';
  isRegistered: boolean;
}) {
  const here = `/courses/${courseSlug}/${materialSlug}`;

  return (
    <div>
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2.5 font-heading text-xs text-muted-foreground">
          {showing === 'full' ? (
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Materi lengkap ({accessReason === 'admin' ? 'admin' : 'ter-enroll'})</span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Pratinjau publik. Tukar enrollment key untuk membuka materi lengkap.</span>
          )}
          {readerSrc && (
            <a href={readerSrc} target="_blank" rel="noopener" className="inline-flex shrink-0 items-center gap-1 hover:text-foreground">
              <Maximize2 className="h-3.5 w-3.5" /> Layar penuh
            </a>
          )}
        </div>
        {readerSrc ? (
          <MaterialFrame src={readerSrc} />
        ) : (
          <div className="grid min-h-[40vh] place-items-center p-10 text-center text-sm text-muted-foreground">
            {hasAccess ? 'Materi lengkap belum diunggah.' : 'Pratinjau untuk materi ini belum tersedia.'}
          </div>
        )}
      </div>

      {!hasAccess && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5 text-primary" /> Buka materi ini</CardTitle>
            <CardDescription>Masukkan enrollment key dari pengajar. Satu key hanya membuka materi yang ditentukan pengajar.</CardDescription>
          </CardHeader>
          <CardContent>
            {!isRegistered ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Masuk untuk menukar enrollment key. Tamu hanya dapat membaca pratinjau.</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild><Link href={`/signin?next=${encodeURIComponent(here)}`}><LogIn className="mr-1 h-4 w-4" /> Masuk</Link></Button>
                  <Button asChild variant="outline"><Link href={`/signup?next=${encodeURIComponent(here)}`}>Buat akun</Link></Button>
                </div>
              </div>
            ) : (
              <RedeemKey />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
