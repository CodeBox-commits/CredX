"use client";

import { type CSSProperties, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** True shortly after mount — drives CSS transitions from their initial to final state.
 *  CSS transitions (unlike rAF-driven JS animation) still land on the final value when the
 *  tab is throttled or in the background, so numbers and bars are never stuck at zero. */
export function useMounted(delay = 30) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return mounted;
}

/** A bar that grows to `pct` (0–100) with a CSS width transition. */
export function GrowBar({ pct, className, style, delay = 0, duration = 700, children }: {
  pct: number; className?: string; style?: CSSProperties; delay?: number; duration?: number; children?: React.ReactNode;
}) {
  const mounted = useMounted();
  return (
    <div
      className={cn("h-full", className)}
      style={{
        width: `${mounted ? Math.max(0, Math.min(100, pct)) : 0}%`,
        transition: `width ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
