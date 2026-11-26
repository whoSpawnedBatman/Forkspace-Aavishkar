import { cn } from "@/lib/utils";

export function SnipItMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 28 32"
      fill="none"
      className={cn("size-7 shrink-0 text-ink", className)}
    >
      <path
        d="M5 2.5h11.5L23.5 9.5V27a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 27V5A2.5 2.5 0 0 1 5 2.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 2.5V8a2 2 0 0 0 2 2h5.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 16.5 7.5 19.5l3 3M17.5 16.5l3 3-3 3M15 15l-2 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SnipItLogo({
  className,
  markClassName,
  textClassName,
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <SnipItMark className={markClassName} />
      <span
        className={cn(
          "text-[15px] font-semibold uppercase tracking-[0.16em] text-ink",
          textClassName,
        )}
      >
        Snip it
      </span>
    </span>
  );
}
