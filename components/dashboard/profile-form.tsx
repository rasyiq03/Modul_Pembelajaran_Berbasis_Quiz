'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage } from '@/lib/labels';

export function ProfileForm({ userId, displayName }: { userId: string; displayName: string }) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const supabase = getSupabaseBrowser();

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() || null }).eq('id', userId);
    setBusy(false);
    setMsg(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: 'Profil tersimpan.' });
    router.refresh();
  }
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ ok: false, text: 'Kata sandi minimal 8 karakter.' });
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false); setPw('');
    setMsg(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: 'Kata sandi diperbarui.' });
  }
  return (
    <div className="space-y-6">
      <form onSubmit={saveName} className="space-y-2">
        <Label htmlFor="dn">Nama tampilan</Label>
        <div className="flex gap-2"><Input id="dn" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /><Button type="submit" disabled={busy}>Simpan</Button></div>
      </form>
      <form onSubmit={savePassword} className="space-y-2">
        <Label htmlFor="pw">Kata sandi baru</Label>
        <div className="flex gap-2"><Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><Button type="submit" variant="outline" disabled={busy}>Ubah</Button></div>
      </form>
      {msg && <p className={msg.ok ? 'text-sm text-success' : 'text-sm text-destructive'} role="status">{msg.text}</p>}
    </div>
  );
}
