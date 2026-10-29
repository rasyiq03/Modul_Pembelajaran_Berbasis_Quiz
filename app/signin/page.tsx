'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrandMark } from '@/components/site/brand-mark';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/supabase/auth-provider';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { safeNext } from '@/lib/safe-next';
import { authError } from '@/lib/labels';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(params.get('error') === 'link' ? 'Tautan konfirmasi tidak valid atau sudah kedaluwarsa. Silakan masuk atau daftar ulang.' : null);
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();
  const supabase = getSupabaseBrowser();

  /* Sudah login (mis. membuka /signin lewat tautan lama): langsung ke tujuan. Sesi tamu anonim tidak dihitung. */
  useEffect(() => {
    if (session && !session.user.is_anonymous) router.replace(next);
  }, [session, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(authError(error.message));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="container-wide py-8 sm:py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <BrandMark />
          <span className="font-heading text-lg font-extrabold">Masuk</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Selamat datang kembali</CardTitle>
            <CardDescription>Masuk untuk membaca materi yang sudah kamu buka dan melihat riwayat kuismu.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata sandi</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Memproses…' : 'Masuk'}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Belum punya akun?{' '}
              <Link href={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-primary hover:underline">
                Buat akun
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
/* useSearchParams butuh batas Suspense agar halaman bisa dirender statis */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
