import { BookOpenText, Building2, FileBarChart, FileSignature, FileText, Landmark, PieChart, ReceiptIndianRupee, Scale, type LucideIcon } from "lucide-react";

export interface DocTypeMeta {
  value: string;
  label: string;
  icon: LucideIcon;
  /** Underwriting checklist importance. */
  need: "required" | "recommended" | "optional";
  hint: string;
  colour: string; // hsl() CSS colour used for the type chip
}

export const DOC_TYPE_META: DocTypeMeta[] = [
  { value: "annual_report", label: "Annual report", icon: BookOpenText, need: "required", hint: "Audited P&L, balance sheet, auditor's report (3 years)", colour: "hsl(var(--chart-1))" },
  { value: "gst_return", label: "GST returns", icon: ReceiptIndianRupee, need: "required", hint: "GSTR-1, GSTR-3B and GSTR-2A/2B for 12 months", colour: "hsl(var(--chart-3))" },
  { value: "bank_statement", label: "Bank statement", icon: Landmark, need: "required", hint: "12 months of operating account statements", colour: "hsl(var(--chart-2))" },
  { value: "sanction_letter", label: "Sanction letters", icon: FileSignature, need: "recommended", hint: "Existing lenders' sanction terms & covenants", colour: "hsl(var(--chart-4))" },
  { value: "mca_filing", label: "MCA filings", icon: Building2, need: "recommended", hint: "Master data, charges, directors (MCA21)", colour: "hsl(var(--chart-5))" },
  { value: "shareholding_pattern", label: "Shareholding", icon: PieChart, need: "recommended", hint: "Promoter holding and pledge details", colour: "hsl(var(--accent))" },
  { value: "financial_statement", label: "Financial statements", icon: FileBarChart, need: "optional", hint: "Standalone / provisional financials", colour: "hsl(var(--chart-1))" },
  { value: "legal_notice", label: "Legal notices", icon: Scale, need: "optional", hint: "NCLT, DRT, NI Act §138, arbitration", colour: "hsl(var(--destructive))" },
  { value: "rating_report", label: "Rating report", icon: FileText, need: "optional", hint: "External credit rating rationale", colour: "hsl(var(--info))" },
];

export const docMeta = (type?: string | null): DocTypeMeta =>
  DOC_TYPE_META.find((d) => d.value === type) ?? { value: "unknown", label: "Unclassified", icon: FileText, need: "optional", hint: "", colour: "hsl(var(--muted-foreground))" };

/** Guess a document type from its filename — shown before upload so analysts can correct it. */
export function guessDocType(filename: string): string | null {
  const n = filename.toLowerCase();
  if (/gstr|gst/.test(n)) return "gst_return";
  if (/bank|statement|stmt|boa/.test(n)) return "bank_statement";
  if (/sanction/.test(n)) return "sanction_letter";
  if (/legal|notice|nclt|drt|court|arbitration/.test(n)) return "legal_notice";
  if (/mca|roc|mgt|aoc|charge/.test(n)) return "mca_filing";
  if (/sharehold|shp/.test(n)) return "shareholding_pattern";
  if (/rating|crisil|icra|care/.test(n)) return "rating_report";
  if (/annual|_ar_|ar_fy|report/.test(n)) return "annual_report";
  if (/balance|p&l|pnl|profit|financial|audited/.test(n)) return "financial_statement";
  return null;
}
