import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden>
        <defs>
          <linearGradient id="cx-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="hsl(var(--primary))" />
            <stop offset="1" stopColor="hsl(var(--chart-5))" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#cx-g)" />
        <path d="M20.5 10.5a7 7 0 1 0 0 11" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M17 13l6 6M23 13l-6 6" stroke="hsl(var(--accent))" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[17px] font-semibold tracking-tight">CredX</span>
          <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Credit Intelligence</span>
        </span>
      )}
    </span>
  );
}
