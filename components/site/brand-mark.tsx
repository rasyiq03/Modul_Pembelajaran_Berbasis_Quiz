/* Logo: empat bentuk jawaban Kahoot (segitiga, belah ketupat, lingkaran, persegi) berbingkai tinta */
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <g stroke="hsl(var(--ink))" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M9.5 3 16.5 15.5h-14z" fill="#E21B3C" />
        <path d="M26.5 2.5 33.5 9.5 26.5 16.5 19.5 9.5z" fill="#1368CE" />
        <circle cx="9.5" cy="26.5" r="6.5" fill="#FFC93C" />
        <rect x="20" y="20" width="13" height="13" rx="1.5" fill="#26890C" />
      </g>
    </svg>
  );
}
