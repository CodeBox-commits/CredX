"use client";

import { useEffect } from "react";

/** Minimal keyboard shortcuts: "mod+k", "g d" style sequences are handled by the palette itself. */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const [mod, key] = combo.includes("+") ? combo.split("+") : [null, combo];
    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (mod === "mod" && !(e.metaKey || e.ctrlKey)) return;
      if (!mod && (typing || e.metaKey || e.ctrlKey || e.altKey)) return;
      if (e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [combo, handler, enabled]);
}
