'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock, Loader2, CheckCircle2, AlertCircle, LogIn, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowser } from '@/lib/supabase/clients';

/* Sama dengan header CSP route /m: materi berjalan di origin terisolasi, tanpa akses ke sesi web */
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';

const ERRORS: Record<string, string> = {
  invalid_key: 'This key is not valid.',
  revoked: 'This key has been revoked.',
  expired: 'This key has expired.',
  exhausted: 'This key has reached its maximum number of uses.',
  enrollment_revoked: 'Your access to this material was revoked by an administrator.',
  login_required: 'Sign in with a registered account to redeem a key.',
};

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
  const router = useRouter();
  const [key, setKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const here = `/courses/${courseSlug}/${materialSlug}`;

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!key.trim()) return;
    setSubmitting(true);
    const { data, error } = await getSupabaseBrowser().rpc('redeem_enrollment_key', { p_key: key.trim() });
    setSubmitting(false);
    if (error) return setResult({ ok: false, message: error.message });
    if (data?.ok) {
      setResult({ ok: true, message: `Access granted to "${data.material_title ?? materialSlug}". Loading the full material…` });
      router.refresh();   // server menerbitkan URL materi lengkap yang baru
    } else {
      setResult({ ok: false, message: ERRORS[data?.error ?? ''] ?? 'Could not redeem this key.' });
    }
  }

  return (
    <div>
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2.5 font-heading text-xs text-muted-foreground">
          {showing === 'full' ? (
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Full material ({accessReason === 'admin' ? 'admin' : 'enrolled'})</span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Public preview. Enroll to unlock the full material.</span>
          )}
          {readerSrc && (
            <a href={readerSrc} target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-foreground">
              <Maximize2 className="h-3.5 w-3.5" /> Open full screen
            </a>
          )}
        </div>
        {readerSrc ? (
          <iframe key={readerSrc} title="Material" src={readerSrc} className="material-iframe" sandbox={SANDBOX} referrerPolicy="no-referrer" />
        ) : (
          <div className="grid min-h-[40vh] place-items-center p-10 text-center text-sm text-muted-foreground">
            {hasAccess ? 'The full material has not been uploaded yet.' : 'No preview is available for this material yet.'}
          </div>
        )}
      </div>

      {!hasAccess && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5 text-primary" /> Unlock this material</CardTitle>
            <CardDescription>Enter the enrollment key from your instructor. A key unlocks this material only.</CardDescription>
          </CardHeader>
          <CardContent>
            {!isRegistered ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Sign in to redeem an enrollment key. Guests can read the preview only.</p>
                <div className="flex gap-2">
                  <Button asChild><Link href={`/signin?next=${encodeURIComponent(here)}`}><LogIn className="mr-1 h-4 w-4" /> Sign in</Link></Button>
                  <Button asChild variant="outline"><Link href={`/signup?next=${encodeURIComponent(here)}`}>Create account</Link></Button>
                </div>
              </div>
            ) : (
              <form onSubmit={redeem} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="key">Enrollment key</Label>
                  <Input id="key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="XXXX-XXXX-XXXX" autoComplete="off" className="font-mono uppercase" />
                </div>
                {result && (
                  <div className={`flex items-start gap-2 rounded-md p-2 text-sm ${result.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>{result.message}</span>
                  </div>
                )}
                <Button type="submit" disabled={submitting || !key.trim()}>
                  {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />}
                  Redeem key
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
