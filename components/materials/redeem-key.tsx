'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowser } from '@/lib/supabase/clients';

const ERRORS: Record<string, string> = {
  invalid_key: 'Key tidak valid. Periksa lagi penulisannya.',
  revoked: 'Key ini sudah dicabut pengajar.',
  expired: 'Key ini sudah kedaluwarsa.',
  exhausted: 'Key ini sudah mencapai batas pemakaian.',
  enrollment_revoked: 'Aksesmu ke materi ini dicabut pengajar. Hubungi pengajar bila ini keliru.',
  login_required: 'Masuk dengan akun terdaftar untuk menukar key.',
};

/** FR-20/21: tukar enrollment key (validasi status, masa berlaku, dan kuota di server) */
export function RedeemKey({ onRedeemed }: { onRedeemed?: (title: string) => void }) {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true); setResult(null);
    const { data, error } = await getSupabaseBrowser().rpc('redeem_enrollment_key', { p_key: key.trim() });
    setBusy(false);
    if (error) return setResult({ ok: false, message: error.message });
    if (data?.ok) {
      setResult({ ok: true, message: data.already ? `Kamu sudah punya akses ke "${data.material_title}".` : `Akses terbuka: "${data.material_title}".` });
      setKey('');
      onRedeemed?.(data.material_title ?? '');
      router.refresh();
    } else setResult({ ok: false, message: ERRORS[data?.error ?? ''] ?? 'Key tidak bisa ditukar.' });
  }

  return (
    <form onSubmit={redeem} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="key">Enrollment key</Label>
        <Input id="key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="XXXX-XXXX-XXXX" autoComplete="off" className="font-heading uppercase tracking-widest" />
      </div>
      {result && (
        <div className={`flex items-start gap-2 rounded-md p-2 text-sm ${result.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`} role="status">
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}<span>{result.message}</span>
        </div>
      )}
      <Button type="submit" disabled={busy || !key.trim()}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />} Tukar key</Button>
    </form>
  );
}
