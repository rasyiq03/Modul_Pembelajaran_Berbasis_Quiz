import { cn } from '@/lib/utils';

/* Sampul kartu: latar pastel + dua bentuk Kahoot. Warna & susunan dipilih dari urutan agar katalog
   tampil berwarna-warni tetapi stabil (kartu yang sama selalu mendapat sampul yang sama). */
const COVERS = [
  { bg: 'cover-violet', a: 'tri', b: 'circle' },
  { bg: 'cover-green', a: 'square', b: 'diamond' },
  { bg: 'cover-blue', a: 'diamond', b: 'circle' },
  { bg: 'cover-red', a: 'circle', b: 'tri' },
] as const;

const SHAPE: Record<string, { fill: string; clip?: string; round?: boolean }> = {
  tri: { fill: '#E21B3C', clip: 'polygon(50% 0,100% 100%,0 100%)' },
  diamond: { fill: '#1368CE', clip: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' },
  circle: { fill: '#FFC93C', round: true },
  square: { fill: '#26890C' },
};

function Shape({ kind, style }: { kind: string; style: React.CSSProperties }) {
  const s = SHAPE[kind];
  return <span className="absolute block" style={{ background: s.fill, clipPath: s.clip, borderRadius: s.round ? '50%' : undefined, ...style }} />;
}

export function Cover({ index, className }: { index: number; className?: string }) {
  const c = COVERS[index % COVERS.length];
  const flip = Math.floor(index / COVERS.length) % 2 === 1;
  return (
    <div className={cn('relative h-24 overflow-hidden border-b-2 border-ink', c.bg, className)} aria-hidden="true">
      <Shape kind={c.a} style={{ width: 64, height: 64, top: 16, [flip ? 'right' : 'left']: 20, transform: 'rotate(10deg)' }} />
      <Shape kind={c.b} style={{ width: 88, height: 88, top: -22, [flip ? 'left' : 'right']: -16 }} />
    </div>
  );
}
