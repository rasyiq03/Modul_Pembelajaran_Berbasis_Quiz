'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrandMark } from '@/components/site/brand-mark';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { safeNext } from '@/lib/safe-next';
import { authError } from '@/lib/labels';

function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = getSupabaseBrowser();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || undefined },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (error) {
      setError(authError(error.message));
      return;
    }
    if (data.session) {
      router.replace(next);
      router.refresh();
    } else {
      setSent(true);
    }
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <BrandMark />
          <span className="font-heading text-lg font-extrabold">Buat akun</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Daftar</CardTitle>
            <CardDescription>Buat akun mahasiswa untuk membuka materi dengan enrollment key dan menyimpan riwayat kuis.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent && (
              <p className="rounded-md bg-success/10 p-3 text-sm text-success">
                Buka tautan konfirmasi yang dikirim ke {email}, lalu kembali untuk masuk.
              </p>
            )}
            <form onSubmit={onSubmit} className="space-y-4" hidden={sent}>
              <div className="space-y-2">
                <Label htmlFor="name">Nama tampilan (opsional)</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata sandi</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Memproses…' : 'Buat akun'}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Sudah punya akun?{' '}
              <Link href={`/signin${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-primary hover:underline">
                Masuk
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
/* useSearchParams butuh batas Suspense agar halaman bisa dirender statis */
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
