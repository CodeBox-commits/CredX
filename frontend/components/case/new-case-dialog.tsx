"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/hooks/queries";
import { formatCr, parseAmount } from "@/lib/format";
import { api } from "@/services/api";
import { ApiError } from "@/services/client";
import { useUi } from "@/store/ui";

const FACILITIES = ["Term Loan", "Cash Credit", "Working Capital Demand Loan", "Overdraft", "Bank Guarantee", "Letter of Credit"];

function Field({ label, children, hint, error, htmlFor }: { label: string; children: React.ReactNode; hint?: string; error?: string; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function NewCaseDialog() {
  const { newCaseOpen, setNewCase } = useUi();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: sectors } = useQuery({ queryKey: ["sectors"], queryFn: api.sectors, enabled: newCaseOpen, staleTime: Infinity });
  const [form, setForm] = useState({
    name: "", gstin: "", cin: "", pan: "", sector: "", incorporation_year: "", city: "", state: "",
    facility_type: "Term Loan", amount: "", tenure_months: "60", collateral_value: "", collateral_type: "", purpose: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const amount = parseAmount(form.amount);
  const collateral = form.collateral_value ? parseAmount(form.collateral_value) : null;

  const create = useMutation({
    mutationFn: () =>
      api.cases.create({
        facility_type: form.facility_type,
        requested_amount: amount,
        tenure_months: Number(form.tenure_months) || 60,
        purpose: form.purpose || null,
        collateral_type: form.collateral_type || null,
        collateral_value: collateral,
        company: {
          name: form.name.trim(),
          gstin: form.gstin.trim() || null,
          cin: form.cin.trim() || null,
          pan: form.pan.trim() || null,
          sector: form.sector || null,
          incorporation_year: form.incorporation_year ? Number(form.incorporation_year) : null,
          city: form.city || null,
          state: form.state || null,
        },
      }),
    onSuccess: (c) => {
      toast.success(`${c.reference} opened`, { description: "Upload the document pack to start ingestion." });
      qc.invalidateQueries({ queryKey: ["cases"] });
      setNewCase(false);
      router.push(`/cases/${c.id}/documents`);
    },
    onError: (e) => {
      if (e instanceof ApiError && Array.isArray(e.details)) {
        const next: Record<string, string> = {};
        (e.details as { loc: string; msg: string }[]).forEach((d) => (next[d.loc.split(".").pop() ?? ""] = d.msg.replace("Value error, ", "")));
        setErrors(next);
      }
      toast.error(errorMessage(e));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 3) next.name = "Enter the borrower's legal name";
    if (!amount) next.amount = "Enter an amount, e.g. 25 cr or 40 lakh";
    setErrors(next);
    if (!Object.keys(next).length) create.mutate();
  };

  return (
    <Dialog open={newCaseOpen} onOpenChange={setNewCase}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> New credit case</DialogTitle>
          <DialogDescription>Open an underwriting case. Statutory identifiers are validated (GSTIN checksum, PAN & CIN formats).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Borrower legal name" htmlFor="nc-name" error={errors.name}>
                <Input id="nc-name" autoFocus placeholder="ABC Textiles Private Limited" value={form.name} onChange={set("name")} />
              </Field>
            </div>
            <Field label="GSTIN" htmlFor="nc-gstin" error={errors.gstin} hint="15 characters, checksum-validated">
              <Input id="nc-gstin" className="font-mono uppercase" maxLength={15} placeholder="29ABCDE1234F1Z5" value={form.gstin} onChange={set("gstin")} />
            </Field>
            <Field label="CIN" htmlFor="nc-cin" error={errors.cin}>
              <Input id="nc-cin" className="font-mono uppercase" maxLength={21} placeholder="U17110TZ2008PTC014562" value={form.cin} onChange={set("cin")} />
            </Field>
            <Field label="Sector">
              <Select value={form.sector} onValueChange={(v) => setForm((f) => ({ ...f, sector: v }))}>
                <SelectTrigger aria-label="Sector"><SelectValue placeholder="Select sector" /></SelectTrigger>
                <SelectContent>{sectors?.map((s) => <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Incorporated (year)" htmlFor="nc-year">
              <Input id="nc-year" inputMode="numeric" placeholder="2008" value={form.incorporation_year} onChange={set("incorporation_year")} />
            </Field>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
            <p className="eyebrow mb-3">Facility requested</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Facility">
                <Select value={form.facility_type} onValueChange={(v) => setForm((f) => ({ ...f, facility_type: v }))}>
                  <SelectTrigger aria-label="Facility"><SelectValue /></SelectTrigger>
                  <SelectContent>{FACILITIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Amount" htmlFor="nc-amount" error={errors.amount || errors.requested_amount} hint={amount ? formatCr(amount) : "e.g. 25 cr, 40 lakh"}>
                <Input id="nc-amount" placeholder="25 cr" value={form.amount} onChange={set("amount")} />
              </Field>
              <Field label="Tenure (months)" htmlFor="nc-tenure">
                <Input id="nc-tenure" inputMode="numeric" value={form.tenure_months} onChange={set("tenure_months")} />
              </Field>
              <Field label="Collateral value" htmlFor="nc-coll" hint={collateral ? formatCr(collateral) : "Optional"}>
                <Input id="nc-coll" placeholder="30 cr" value={form.collateral_value} onChange={set("collateral_value")} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Security offered" htmlFor="nc-ctype">
                  <Input id="nc-ctype" placeholder="Equitable mortgage of factory land & building" value={form.collateral_type} onChange={set("collateral_type")} />
                </Field>
              </div>
            </div>
            <div className="mt-4">
              <Field label="Purpose" htmlFor="nc-purpose">
                <Textarea id="nc-purpose" rows={2} placeholder="Capex for capacity expansion…" value={form.purpose} onChange={set("purpose")} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNewCase(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Open case
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
