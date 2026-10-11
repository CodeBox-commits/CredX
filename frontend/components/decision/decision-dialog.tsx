"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleCheckBig, Loader2, Users, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/hooks/queries";
import { decisionLabel } from "@/lib/format";
import { decisionTone, toneHsl } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";

const OPTIONS = ["APPROVE", "APPROVE_WITH_CONDITIONS", "REFER", "DECLINE"] as const;
const ICONS = { APPROVE: CheckCircle2, APPROVE_WITH_CONDITIONS: CircleCheckBig, REFER: Users, DECLINE: XCircle };

export function DecisionDialog({ open, onOpenChange, caseId, suggested }: { open: boolean; onOpenChange: (o: boolean) => void; caseId: string; suggested: string }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<string>(suggested);
  const [rationale, setRationale] = useState("");
  const m = useMutation({
    mutationFn: () => api.cases.decide(caseId, decision, rationale),
    onSuccess: () => {
      toast.success(`Recorded: ${decisionLabel(decision)}`);
      qc.invalidateQueries({ queryKey: ["case", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record sanction decision</DialogTitle>
          <DialogDescription>The model recommends <b>{decisionLabel(suggested)}</b>. Your decision and rationale are written to the audit trail.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Decision">
          {OPTIONS.map((o) => {
            const Icon = ICONS[o];
            const active = decision === o;
            const colour = toneHsl[decisionTone(o)];
            return (
              <button key={o} type="button" role="radio" aria-checked={active} onClick={() => setDecision(o)}
                className={cn("flex items-center gap-2.5 rounded-xl border-2 p-3 text-left text-sm font-medium transition", active ? "shadow-sm" : "border-border hover:border-foreground/20")}
                style={active ? { borderColor: colour, background: colour.replace(")", " / 0.08)") } : undefined}>
                <Icon className="h-4 w-4 shrink-0" style={{ color: colour }} />
                <span className="min-w-0 flex-1">{decisionLabel(o)}</span>
                {o === suggested && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">model</span>}
              </button>
            );
          })}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rationale">Rationale</Label>
          <Textarea id="rationale" rows={4} placeholder="Basis for the decision, conditions imposed, deviations approved…" value={rationale} onChange={(e) => setRationale(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={rationale.trim().length < 10 || m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Record decision</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
