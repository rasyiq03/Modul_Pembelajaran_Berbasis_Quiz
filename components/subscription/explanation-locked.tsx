import Link from 'next/link';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Pembahasan soal hanya untuk pelanggan aktif; kunci jawaban tetap tampil */
export function ExplanationLocked({ className }: { className?: string }) {
  return (
    <p className={cn('note-box flex flex-wrap items-center gap-x-2 gap-y-1 text-sm', className)}>
      <Crown className="h-4 w-4 shrink-0" />
      <span>Pembahasan lengkap khusus pelanggan.</span>
      <Link href="/dashboard/subscription" className="font-heading font-bold">Lihat langganan</Link>
    </p>
  );
}
