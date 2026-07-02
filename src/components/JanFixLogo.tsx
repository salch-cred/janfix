export function JanFixLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" fill="none" className={className}>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 16 12 16s12-7.75 12-16C24 5.373 18.627 0 12 0z" fill="#1d4ed8"/>
      <circle cx="12" cy="11" r="9" fill="white"/>
      <path d="M12 5.5 c-1.5-2 -4.5-0.5 -4.5 2.5 0 2.5 4.5 5 4.5 5 s4.5-2.5 4.5-5 c0-3 -3-4.5 -4.5-2.5 z" fill="#dc2626"/>
      <g fill="#1d4ed8">
        <circle cx="12" cy="11.5" r="1.5" />
        <path d="M9 16 c0-2 2-2.5 3-2.5 s3 0.5 3 2.5 v1 h-6 z" />
        <circle cx="8" cy="12" r="1" />
        <path d="M6 15 c0-1.5 1-2 2-2 s2 0.5 2 2 v0.5 h-4 z" />
        <circle cx="16" cy="12" r="1" />
        <path d="M14 15 c0-1.5 1-2 2-2 s2 0.5 2 2 v0.5 h-4 z" />
      </g>
    </svg>
  );
}
