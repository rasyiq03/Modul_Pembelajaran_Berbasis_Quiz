'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { errorMessage } from '@/lib/labels';
import { AVATARS } from '@/lib/gamification';
import { useAuth } from '@/lib/supabase/auth-provider';
import { cn } from '@/lib/utils';

export function ProfileForm({ userId, displayName, avatar: initialAvatar }: { userId: string; displayName: string; avatar: string }) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(displayName);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const supabase = getSupabaseBrowser();

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() || null, avatar }).eq('id', userId);
    setBusy(false);
    setMsg(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: 'Profil tersimpan.' });
    await refreshProfile();
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
      <form onSubmit={saveName} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="font-heading text-sm font-bold">Avatar</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pilih avatar">
            {AVATARS.map((a) => (
              <button key={a} type="button" role="radio" aria-checked={avatar === a} aria-label={`Avatar ${a}`} onClick={() => setAvatar(a)}
                className={cn('grid h-11 w-11 place-items-center rounded-full border-[1.5px] text-2xl transition', avatar === a ? 'border-primary bg-secondary ring-2 ring-primary' : 'border-border bg-card hover:border-primary')}>
                {a}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <Label htmlFor="dn">Nama tampilan</Label>
          <p className="text-xs text-muted-foreground">Ditampilkan di papan peringkat dan kuis live.</p>
          <div className="flex gap-2"><Input id="dn" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /><Button type="submit" disabled={busy}>Simpan</Button></div>
        </div>
      </form>
      <form onSubmit={savePassword} className="space-y-2">
        <Label htmlFor="pw">Kata sandi baru</Label>
        <div className="flex gap-2"><Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><Button type="submit" variant="outline" disabled={busy}>Ubah</Button></div>
      </form>
      {msg && <p className={msg.ok ? 'text-sm text-success' : 'text-sm text-destructive'} role="status">{msg.text}</p>}
    </div>
  );
}
