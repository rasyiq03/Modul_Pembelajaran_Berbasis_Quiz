import { JoinForm } from '@/components/live/join-form';

export const metadata = { title: 'Gabung kuis · KuisKelas' };

export default function JoinPage({ searchParams }: { searchParams: { code?: string } }) {
  return (
    <div className="container-wide py-8 sm:py-10">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <p className="eyebrow">Kuis live</p>
          <h1 className="text-[clamp(1.75rem,3.4vw,2.25rem)]">Gabung sesi kuis</h1>
          <p className="text-muted-foreground">Masukkan kode dari layar pengajar. Tidak perlu akun untuk sesi yang mengizinkan tamu.</p>
        </header>
        <JoinForm initialCode={(searchParams.code ?? '').toUpperCase().slice(0, 6)} />
      </div>
    </div>
  );
}
