// Indian number formatting (lakh/crore) and display helpers.

const groupIndian = (n: number): string => {
  const s = Math.trunc(Math.abs(n)).toString();
  if (s.length <= 3) return s;
  const tail = s.slice(-3);
  const head = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${head},${tail}`;
};

/** 12000000 -> "₹1,20,00,000" */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return `${amount < 0 ? "-" : ""}₹${groupIndian(Math.round(amount))}`;
}

/** 12000000 -> "₹1.20 Cr", 450000 -> "₹4.50 L" */
export function formatCr(amount: number | null | undefined, digits = 2): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const sign = amount < 0 ? "-" : "";
  const v = Math.abs(amount);
  if (v >= 1e7) return `${sign}₹${(v / 1e7).toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits })} Cr`;
  if (v >= 1e5) return `${sign}₹${(v / 1e5).toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits })} L`;
  return `${sign}₹${groupIndian(v)}`;
}

export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${(v * 100).toFixed(digits)}%`;

export const times = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${v.toFixed(digits)}x`;

export const num = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: digits });

export const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);

export const titleCase = (s: string | null | undefined) =>
  (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const decisionLabel = (d: string | null | undefined) =>
  ({ APPROVE: "Approve", APPROVE_WITH_CONDITIONS: "Approve w/ conditions", REFER: "Refer", DECLINE: "Decline" })[d ?? ""] ?? "Pending";

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export const bytes = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

/** Parse "25", "25 cr", "2.5 crore", "40 lakh", "2,50,00,000" into rupees. */
export function parseAmount(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/[₹,\s]/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)(cr|crore|crores|l|lakh|lakhs|lac)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2];
  if (!unit) return n < 10000 ? n * 1e7 : n; // small bare numbers are crores in lending UIs
  return unit.startsWith("c") ? n * 1e7 : n * 1e5;
}
