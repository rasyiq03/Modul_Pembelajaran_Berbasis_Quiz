/* Logo: empat bentuk jawaban Kahoot dari panggung kuis materi (segitiga, belah ketupat, lingkaran, persegi) */
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <rect width="36" height="36" rx="8" className="fill-primary" />
      <path d="M10.5 5.5 15.5 14.5h-10z" fill="#E21B3C" />
      <path d="M25.5 5 30 9.5 25.5 14 21 9.5z" fill="#1368CE" />
      <circle cx="10.5" cy="25.5" r="4.6" fill="#F5B301" />
      <rect x="21" y="21" width="9" height="9" rx="1" fill="#26890C" />
    </svg>
  );
}
