"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/hooks/queries";
import { api } from "@/services/api";

export function EscalateDialog({ open, onOpenChange, caseId }: { open: boolean; onOpenChange: (o: boolean) => void; caseId: string }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => api.escalations.create(caseId, reason),
    onSuccess: () => { toast.success("Escalated to credit committee"); setReason(""); onOpenChange(false); qc.invalidateQueries({ queryKey: ["case", caseId] }); qc.invalidateQueries({ queryKey: ["cases"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escalate to credit committee</DialogTitle>
          <DialogDescription>The case moves to “Committee” and credit managers are asked to review it.</DialogDescription>
        </DialogHeader>
        <Textarea rows={4} autoFocus placeholder="Why does this need committee review? e.g. policy deviation on DSCR, unresolved fraud alerts…" value={reason} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={reason.trim().length < 10 || m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Escalate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
