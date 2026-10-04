"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorMessage } from "@/hooks/queries";
import { decisionLabel } from "@/lib/format";
import { api } from "@/services/api";

const OPTIONS = ["APPROVE", "APPROVE_WITH_CONDITIONS", "REFER", "DECLINE"] as const;

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
        <ToggleGroup type="single" value={decision} onValueChange={(v) => v && setDecision(v)} className="grid grid-cols-2 gap-2" aria-label="Decision">
          {OPTIONS.map((o) => <ToggleGroupItem key={o} value={o} className="border border-border data-[state=on]:border-primary">{decisionLabel(o)}</ToggleGroupItem>)}
        </ToggleGroup>
        <div className="space-y-1.5">
          <Label htmlFor="rationale">Rationale</Label>
          <Textarea id="rationale" rows={4} placeholder="Basis for the decision, conditions imposed, deviations approved…" value={rationale} onChange={(e) => setRationale(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={rationale.trim().length < 10 || m.isPending}>{m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record decision</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
