import { LivePlayer } from '@/components/live/live-player';

export const metadata = { title: 'Kuis live · Cognify' };

export default async function PlayPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <div className="container-page py-8">
      <LivePlayer sessionId={params.id} />
    </div>
  );
}
