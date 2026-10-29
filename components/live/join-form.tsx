'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/supabase/auth-provider';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage } from '@/lib/labels';

/** FR-50/51: bergabung dengan kode + nama tampilan. Tamu masuk anonim di belakang layar. */
export function JoinForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [code, setCode] = useState(initialCode);
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        const { error: ae } = await supabase.auth.signInAnonymously();
        if (ae) throw ae;
      }
      const { data, error: je } = await supabase.rpc('join_quiz_session', { p_code: code.trim(), p_nickname: nick.trim() || profile?.display_name || '' });
      if (je) throw je;
      router.push(`/play/${data.session_id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={join} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Kode sesi</Label>
            <Input
              id="code" value={code} required autoComplete="off" inputMode="text" maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              className="h-14 text-center font-heading text-2xl font-extrabold tracking-[0.3em]" placeholder="ABC123"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nick">Nama tampilan</Label>
            <Input id="nick" value={nick} maxLength={24} onChange={(e) => setNick(e.target.value)} placeholder={profile?.display_name || 'mis. Budi'} required={!profile} />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy || code.length < 6}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Gabung
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
