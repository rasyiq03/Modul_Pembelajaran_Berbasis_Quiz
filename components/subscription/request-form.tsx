'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage } from '@/lib/labels';

const ERRORS: Record<string, string> = {
  login_required: 'Masuk dengan akun terdaftar dulu untuk mengajukan langganan.',
  already_pending: 'Kamu sudah punya pengajuan yang sedang ditinjau admin.',
  already_active: 'Langgananmu masih aktif tanpa batas waktu.',
};

/** Ajukan langganan ke admin. Setelah terkirim, halaman dimuat ulang agar status "menunggu" tampil. */
export function SubscriptionRequestForm({ submitLabel = 'Ajukan langganan' }: { submitLabel?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setResult(null);
    const { data, error } = await getSupabaseBrowser().rpc('request_subscription', { p_message: message.trim() || null });
    setBusy(false);
    if (error) return setResult({ ok: false, text: errorMessage(error) });
    if (!data?.ok) return setResult({ ok: false, text: ERRORS[data?.error ?? ''] ?? 'Pengajuan belum bisa dikirim.' });
    setResult({ ok: true, text: 'Pengajuan terkirim. Admin akan meninjaunya; materi langganan terbuka otomatis setelah disetujui.' });
    setMessage('');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="sub-message">Pesan untuk admin (opsional)</Label>
        <Textarea
          id="sub-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Mis. nama lengkap, NIM, kelas, dan mata kuliah yang kamu ikuti"
        />
      </div>
      {result && (
        <div role="status" className={`flex items-start gap-2 rounded-md p-2.5 font-heading text-sm ${result.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{result.text}</span>
        </div>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />} {submitLabel}
      </Button>
    </form>
  );
}
