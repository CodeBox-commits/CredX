"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Check, CloudUpload, FileStack, Landmark, Loader2, Play, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, qk } from "@/hooks/queries";
import { docMeta, guessDocType } from "@/lib/doc-types";
import { bytes, formatCr, parseAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { ApiError } from "@/services/client";
import { useUi } from "@/store/ui";

const FACILITIES = ["Term Loan", "Cash Credit", "Working Capital Demand Loan", "Overdraft", "Bank Guarantee", "Letter of Credit"];
const STEPS = [
  { title: "Borrower", icon: Building2 },
  { title: "Facility", icon: Landmark },
  { title: "Documents", icon: FileStack },
];
const GST_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "03": "Punjab", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar",
  "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "27": "Maharashtra",
  "29": "Karnataka", "30": "Goa", "32": "Kerala", "33": "Tamil Nadu", "36": "Telangana", "37": "Andhra Pradesh",
};
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CIN_RE = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;

function Field({ label, children, hint, error, htmlFor, className }: { label: string; children: React.ReactNode; hint?: React.ReactNode; error?: string; htmlFor?: string; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px]">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const EMPTY = {
  name: "", gstin: "", cin: "", pan: "", sector: "", incorporation_year: "", city: "", state: "",
  facility_type: "Term Loan", amount: "", tenure_months: "60", collateral_value: "", collateral_type: "", purpose: "",
};

export function NewCaseDialog() {
  const { newCaseOpen, setNewCase } = useUi();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: sectors } = useQuery({ queryKey: ["sectors"], queryFn: api.sectors, enabled: newCaseOpen, staleTime: Infinity });
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const amount = parseAmount(form.amount);
  const collateral = form.collateral_value ? parseAmount(form.collateral_value) : null;

  const onGstin = (raw: string) => {
    const gstin = raw.toUpperCase().replace(/\s/g, "");
    setForm((f) => ({
      ...f, gstin,
      pan: gstin.length >= 12 && !f.pan ? gstin.slice(2, 12) : f.pan,
      state: gstin.length >= 2 && GST_STATES[gstin.slice(0, 2)] && !f.state ? GST_STATES[gstin.slice(0, 2)] : f.state,
    }));
  };

  const onDrop = useCallback((accepted: File[]) => setFiles((prev) => [...prev, ...accepted.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]), []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxSize: 25 * 1024 * 1024,
    accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg", ".tif", ".tiff"], "text/plain": [".txt"], "text/csv": [".csv"] },
  });

  const validate = (s: number) => {
    const next: Record<string, string> = {};
    if (s === 0) {
      if (form.name.trim().length < 3) next.name = "Enter the borrower's legal name";
      if (form.gstin && !GSTIN_RE.test(form.gstin)) next.gstin = "GSTIN should look like 29ABCDE1234F1Z5";
      if (form.cin && !CIN_RE.test(form.cin.toUpperCase())) next.cin = "CIN should look like U17110TZ2008PTC014562";
    }
    if (s === 1 && !amount) next.amount = "Enter an amount, e.g. 25 cr or 40 lakh";
    setErrors(next);
    return !Object.keys(next).length;
  };

  const reset = () => {
    setStep(0); setForm(EMPTY); setFiles([]); setErrors({}); setBusy(null);
  };
  const close = (open: boolean) => {
    setNewCase(open);
    if (!open) setTimeout(reset, 200);
  };

  const finish = async (analyse: boolean) => {
    if (!validate(0) || !validate(1)) return;
    setBusy(analyse ? "analyse" : "create");
    try {
      const c = await api.cases.create({
        facility_type: form.facility_type,
        requested_amount: amount,
        tenure_months: Number(form.tenure_months) || 60,
        purpose: form.purpose || null,
        collateral_type: form.collateral_type || null,
        collateral_value: collateral,
        company: {
          name: form.name.trim(), gstin: form.gstin.trim() || null, cin: form.cin.trim().toUpperCase() || null, pan: form.pan.trim() || null,
          sector: form.sector || null, incorporation_year: form.incorporation_year ? Number(form.incorporation_year) : null,
          city: form.city || null, state: form.state || null,
        },
      });
      if (files.length) await api.documents.upload(c.id, files, { autoAnalyze: analyse }, () => undefined);
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      toast.success(`${c.reference} opened`, { description: files.length ? (analyse ? "Extraction and full analysis are running." : "Documents are being extracted.") : "Upload the document pack to start." });
      close(false);
      router.push(files.length ? `/cases/${c.id}` : `/cases/${c.id}/documents`);
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) {
        const next: Record<string, string> = {};
        (e.details as { loc: string; msg: string }[]).forEach((d) => (next[d.loc.split(".").pop() ?? ""] = d.msg.replace("Value error, ", "")));
        setErrors(next);
        setStep(next.amount || next.requested_amount ? 1 : 0);
      }
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <Dialog open={newCaseOpen} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-border px-6 pb-5 pt-6">
          <DialogTitle className="text-lg">New credit case</DialogTitle>
          <DialogDescription className="mt-1">Three quick steps — then CredX extracts, researches, checks for fraud and scores the borrower.</DialogDescription>
          <ol className="mt-5 flex items-center">
            {STEPS.map((s, i) => (
              <li key={s.title} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                <button type="button" onClick={() => i < step && setStep(i)} className="flex items-center gap-2" disabled={i > step}>
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition",
                    i < step ? "border-primary bg-primary text-primary-foreground" : i === step ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                    {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                  </span>
                  <span className={cn("text-sm font-medium", i > step && "text-muted-foreground")}>{s.title}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className="mx-3 h-0.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: i < step ? "100%" : "0%" }} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="max-h-[56vh] overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Borrower legal name" htmlFor="nc-name" error={errors.name} className="sm:col-span-2">
                    <Input id="nc-name" autoFocus placeholder="ABC Textiles Private Limited" value={form.name} onChange={set("name")} />
                  </Field>
                  <Field label="GSTIN" htmlFor="nc-gstin" error={errors.gstin}
                    hint={form.gstin.length >= 2 && GST_STATES[form.gstin.slice(0, 2)] ? <span className="text-success">✓ {GST_STATES[form.gstin.slice(0, 2)]} · PAN auto-filled</span> : "Fills PAN and state automatically"}>
                    <Input id="nc-gstin" className="font-mono uppercase" maxLength={15} placeholder="29ABCDE1234F1Z5" value={form.gstin} onChange={(e) => onGstin(e.target.value)} />
                  </Field>
                  <Field label="CIN" htmlFor="nc-cin" error={errors.cin}>
                    <Input id="nc-cin" className="font-mono uppercase" maxLength={21} placeholder="U17110TZ2008PTC014562" value={form.cin} onChange={set("cin")} />
                  </Field>
                  <Field label="PAN" htmlFor="nc-pan">
                    <Input id="nc-pan" className="font-mono uppercase" maxLength={10} placeholder="ABCDE1234F" value={form.pan} onChange={set("pan")} />
                  </Field>
                  <Field label="Sector">
                    <Select value={form.sector} onValueChange={(v) => setForm((f) => ({ ...f, sector: v }))}>
                      <SelectTrigger aria-label="Sector"><SelectValue placeholder="Select sector" /></SelectTrigger>
                      <SelectContent>{sectors?.map((s) => <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="City" htmlFor="nc-city"><Input id="nc-city" placeholder="Pune" value={form.city} onChange={set("city")} /></Field>
                  <Field label="State" htmlFor="nc-state"><Input id="nc-state" placeholder="Maharashtra" value={form.state} onChange={set("state")} /></Field>
                  <Field label="Incorporated (year)" htmlFor="nc-year"><Input id="nc-year" inputMode="numeric" placeholder="2008" value={form.incorporation_year} onChange={set("incorporation_year")} /></Field>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Facility type" className="sm:col-span-2">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {FACILITIES.map((fac) => (
                        <button key={fac} type="button" onClick={() => setForm((f) => ({ ...f, facility_type: fac }))}
                          className={cn("rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition", form.facility_type === fac ? "border-primary bg-primary/[0.07] text-primary" : "border-border hover:border-foreground/20")}>
                          {fac}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Amount requested" htmlFor="nc-amount" error={errors.amount || errors.requested_amount}
                    hint={amount ? <span className="numeric font-medium text-foreground">{formatCr(amount)}</span> : "e.g. 25 cr, 40 lakh"}>
                    <Input id="nc-amount" autoFocus placeholder="25 cr" value={form.amount} onChange={set("amount")} />
                  </Field>
                  <Field label="Tenure (months)" htmlFor="nc-tenure">
                    <Input id="nc-tenure" inputMode="numeric" value={form.tenure_months} onChange={set("tenure_months")} />
                  </Field>
                  <Field label="Security offered" htmlFor="nc-ctype">
                    <Input id="nc-ctype" placeholder="Mortgage of factory land & building" value={form.collateral_type} onChange={set("collateral_type")} />
                  </Field>
                  <Field label="Security value" htmlFor="nc-coll"
                    hint={collateral ? <span className="numeric">{formatCr(collateral)}{amount ? ` · ${(collateral / amount).toFixed(2)}x cover` : ""}</span> : "Optional"}>
                    <Input id="nc-coll" placeholder="30 cr" value={form.collateral_value} onChange={set("collateral_value")} />
                  </Field>
                  <Field label="Purpose" htmlFor="nc-purpose" className="sm:col-span-2">
                    <Textarea id="nc-purpose" rows={2} placeholder="Capex for capacity expansion…" value={form.purpose} onChange={set("purpose")} />
                  </Field>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div {...getRootProps()} className={cn("flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
                    isDragActive ? "border-primary bg-primary/[0.07]" : "border-border bg-surface-2/60 hover:border-primary/50")}>
                    <input {...getInputProps()} />
                    <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white"><CloudUpload className="h-5 w-5" /></span>
                    <p className="font-semibold">Drop the document pack</p>
                    <p className="mt-1 text-sm text-muted-foreground">Annual report, GST returns, bank statement, legal notices… You can also add these later.</p>
                  </div>
                  {files.length > 0 && (
                    <ul className="divide-y divide-border/70 rounded-xl border border-border">
                      {files.map((f) => {
                        const meta = docMeta(guessDocType(f.name));
                        return (
                          <li key={f.name + f.size} className="flex items-center gap-3 px-3 py-2 text-sm">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: meta.colour.replace(")", " / 0.12)"), color: meta.colour }}><meta.icon className="h-3.5 w-3.5" /></span>
                            <span className="min-w-0 flex-1 truncate">{f.name}</span>
                            <span className="text-xs text-muted-foreground">{meta.value === "unknown" ? bytes(f.size) : meta.label}</span>
                            <button type="button" onClick={() => setFiles((p) => p.filter((x) => x !== f))} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={`Remove ${f.name}`}><X className="h-3.5 w-3.5" /></button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="rounded-xl bg-muted/50 p-3 text-[13px]">
                    <p className="font-medium">{form.name || "New borrower"}</p>
                    <p className="text-muted-foreground">{form.facility_type} · {amount ? formatCr(amount) : "—"} · {form.tenure_months} months{form.gstin ? ` · ${form.gstin}` : ""}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-2/60 px-6 py-4">
          {step > 0 ? <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={!!busy}><ArrowLeft /> Back</Button> : <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>}
          {step < 2 ? (
            <Button onClick={() => validate(step) && setStep(step + 1)}>Continue <ArrowRight /></Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => finish(false)} disabled={!!busy}>{busy === "create" && <Loader2 className="animate-spin" />} {files.length ? "Create & extract" : "Create case"}</Button>
              {files.length > 0 && <Button onClick={() => finish(true)} disabled={!!busy}>{busy === "analyse" ? <Loader2 className="animate-spin" /> : <Play />} Create & analyse</Button>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
