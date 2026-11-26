export function SnipbaseMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6.5 3.75H16.5L21.5 8.75V22.25C21.5 23.35 20.6 24.25 19.5 24.25H6.5C5.4 24.25 4.5 23.35 4.5 22.25V5.75C4.5 4.65 5.4 3.75 6.5 3.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M16 4V9H21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 14.25L8.25 16.5L10.5 18.75M15.5 14.25L17.75 16.5L15.5 18.75M13.75 13.5L12.25 19.5"
        stroke="var(--action)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
