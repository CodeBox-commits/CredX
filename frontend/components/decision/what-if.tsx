"use client";

import { useState } from "react";

import { DecisionBadge, ScoreRing } from "@/components/common/primitives";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { decide } from "@/lib/policy";
import type { Score } from "@/types/api";

export function WhatIf({ s }: { s: Score }) {
  const [on, setOn] = useState<Record<string, boolean>>({});
  if (!s.what_if.length) return <p className="text-sm text-muted-foreground">No material improvement levers — the score is already near its ceiling.</p>;
  const gain = s.what_if.reduce((sum, w) => sum + (on[w.feature] ? w.score_gain : 0), 0);
  const projected = Math.min(900, s.credit_score + gain);
  const knockout = s.policy.knockouts.length > 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl bg-surface-2 p-3">
        <ScoreRing score={projected} size={104} stroke={8} label="Projected" />
        <div className="min-w-0 space-y-1.5">
          <p className="numeric text-sm font-semibold">{gain ? <span className="text-success">+{gain} pts</span> : <span className="text-muted-foreground">Toggle a lever below</span>}</p>
          <DecisionBadge decision={decide(projected, { knockouts: knockout ? 1 : 0 })} />
          {knockout && <p className="text-[11px] text-destructive">Policy knock-outs still apply</p>}
        </div>
      </div>
      <ul className="space-y-2">
        {s.what_if.map((w) => (
          <li key={w.feature}>
            <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition", on[w.feature] ? "border-success/40 bg-success/[0.06]" : "border-border hover:bg-muted/40")}>
              <Switch checked={!!on[w.feature]} onCheckedChange={(v) => setOn((o) => ({ ...o, [w.feature]: v }))} aria-label={`Simulate ${w.label}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{w.label}</span>
                <span className="numeric block text-xs text-muted-foreground">{w.current} → <b className="text-foreground">{w.target}</b></span>
              </span>
              <span className="numeric text-sm font-semibold text-success">+{w.score_gain}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
