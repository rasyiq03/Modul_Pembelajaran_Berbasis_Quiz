import { LivePlayer } from '@/components/live/live-player';

export const metadata = { title: 'Kuis live · KuisKelas' };

export default function PlayPage({ params }: { params: { id: string } }) {
  return (
    <div className="container-wide py-8 sm:py-10">
      <LivePlayer sessionId={params.id} />
    </div>
  );
}
