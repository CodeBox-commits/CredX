// In-browser mock of the CredX API, enabled with NEXT_PUBLIC_DEMO_MODE=true.
// Lets the whole product run without the backend (Vercel previews, hackathon judging, UI work)
// while exercising exactly the same typed contracts as the real API. Data is fictional.

import type {
  AuditEntry, Cam, ChatReply, CreditCase, DocumentRecord, Escalation, Fraud, Job, Note, Override, Research, Score, User,
} from "@/types/api";

import {
  ago, buildCam, buildCase, buildDashboard, buildDocumentDetail, buildDocuments, buildFinancials, buildFraud, buildNotes,
  buildOverview, buildResearch, buildScore, buildTimeline, USERS,
} from "./build";
import { CR, type DemoBorrower, PORTFOLIO } from "./portfolio";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface CaseState {
  spec: DemoBorrower;
  record: CreditCase;
  score: Score | null;
  research: Research | null;
  fraud: Fraud | null;
  docs: DocumentRecord[];
  notes: Note[];
  cam: Cam | null;
  camComments: Record<string, string>;
  overrides: Override[];
  escalations: Escalation[];
  analyzed: boolean;
}

interface JobState extends Job {
  durationMs: number;
  onDone?: () => void;
}

const JOB_STEPS: Record<Job["kind"], [string, string][]> = {
  full_analysis: [["ingest", "Document AI"], ["research", "Secondary research"], ["fraud", "Fraud graph"], ["score", "Credit scoring"], ["cam", "CAM draft"]],
  ingest_document: [["parse", "Parse & OCR"], ["tables", "Tables"], ["classify", "Classify"], ["extract", "Extract fields"], ["normalize", "Normalise"]],
  research: [["queries", "Plan queries"], ["fetch", "Fetch sources"], ["classify", "Classify findings"], ["summarize", "Summarise"]],
  fraud: [["graph", "Build graph"], ["cycles", "Detect cycles"], ["gst", "GST checks"], ["score", "Score"]],
  score: [["features", "Features"], ["model", "XGBoost + SHAP"], ["policy", "Policy & pricing"]],
  cam: [["assemble", "Assemble sections"], ["narrative", "Write narrative"], ["export", "Export PDF/DOCX"]],
};

const store = {
  cases: new Map<string, CaseState>(),
  jobs: new Map<string, JobState>(),
  audit: [] as AuditEntry[],
  chat: [] as { id: string; case_id: string | null; role: "user" | "assistant"; content: string; provider: string | null; created_at: string }[],
  users: [...USERS],
  seeded: false,
};

function seed() {
  if (store.seeded) return;
  store.seeded = true;
  for (const spec of PORTFOLIO) addCase(spec, true);
}

function addCase(spec: DemoBorrower, analyzed: boolean): CaseState {
  const score = analyzed ? buildScore(spec) : null;
  const placeholderScore = score ?? buildScore(spec);
  const record = buildCase(spec, placeholderScore);
  if (!analyzed) Object.assign(record, { latest_score: null, latest_risk_level: null, latest_fraud_score: null, status: "draft" });
  const research = analyzed ? buildResearch(spec) : null;
  const fraud = analyzed ? buildFraud(spec) : null;
  const state: CaseState = {
    spec, record, score, research, fraud, docs: analyzed ? buildDocuments(spec) : [], notes: analyzed ? buildNotes(spec) : [],
    cam: null, camComments: {}, overrides: [], escalations: [], analyzed,
  };
  if (analyzed && score && research && fraud) state.cam = buildCam(spec, score, research, fraud);
  if (analyzed && spec.status === "escalated") {
    state.escalations.push({ id: `${spec.key}-esc-0`, case_id: spec.key, to_role: "credit_manager", reason: spec.key === "nebula" ? "Critical fraud indicators and going-concern doubt — committee review required." : "Score below auto-approval band with capacity concerns.", status: "open", resolution: null, raised_by: USERS[0], resolved_by: null, resolved_at: null, created_at: ago(spec.updatedHoursAgo) });
  }
  store.cases.set(spec.key, state);
  return state;
}

// ---------------------------------------------------------------- helpers
class DemoError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);
const getCase = (id: string) => {
  const c = store.cases.get(id);
  if (!c) throw new DemoError(404, "NOT_FOUND", "Case not found");
  return c;
};
const me = (): User => {
  try {
    const raw = JSON.parse(localStorage.getItem("credx-auth") ?? "{}");
    return (raw?.state?.user as User) ?? USERS[0];
  } catch {
    return USERS[0];
  }
};
function audit(caseId: string | null, action: string, summary: string) {
  store.audit.unshift({ id: uid(), created_at: new Date().toISOString(), actor_email: me().email, action, entity_type: "case", entity_id: caseId, case_id: caseId, summary, details: {}, request_id: uid() });
}

function jobView(j: JobState): Job {
  const started = new Date(j.created_at).getTime();
  const elapsed = Date.now() - started;
  const progress = Math.min(100, Math.round((elapsed / j.durationMs) * 100));
  const steps = JOB_STEPS[j.kind];
  const active = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));
  const done = progress >= 100;
  if (done && j.status !== "succeeded") {
    j.status = "succeeded";
    j.finished_at = new Date(started + j.durationMs).toISOString();
    j.duration_ms = j.durationMs;
    j.onDone?.();
    j.onDone = undefined;
  }
  return {
    id: j.id, kind: j.kind, case_id: j.case_id, document_id: j.document_id, status: done ? "succeeded" : "running", progress,
    stage: done ? "complete" : steps[active][0], message: done ? "Completed" : `${steps[active][1]}…`,
    steps: steps.map(([key, label], i) => ({ key, label, status: done || i < active ? "done" : i === active ? "running" : "pending" })),
    result: done ? { ok: true } : null, error: null, attempts: 1, backend: "demo", created_at: j.created_at,
    started_at: j.created_at, finished_at: done ? j.finished_at : null, duration_ms: done ? j.durationMs : null,
  };
}

function startJob(kind: Job["kind"], caseId: string | null, durationMs: number, onDone?: () => void): Job {
  const j: JobState = {
    id: `job-${uid()}`, kind, case_id: caseId, document_id: null, status: "running", progress: 0, stage: null, message: null, steps: [],
    result: null, error: null, attempts: 1, backend: "demo", created_at: new Date().toISOString(), started_at: new Date().toISOString(),
    finished_at: null, duration_ms: null, durationMs, onDone,
  };
  store.jobs.set(j.id, j);
  return jobView(j);
}

function runAnalysis(c: CaseState) {
  c.score = buildScore(c.spec);
  c.research = buildResearch(c.spec);
  c.fraud = buildFraud(c.spec);
  c.notes = c.notes.length ? c.notes : buildNotes(c.spec);
  c.cam = buildCam(c.spec, c.score, c.research, c.fraud, c.camComments);
  c.analyzed = true;
  c.docs = c.docs.map((d) => ({ ...d, status: "processed" as const }));
  Object.assign(c.record, {
    status: c.record.status === "draft" || c.record.status === "analyzing" ? "in_review" : c.record.status,
    latest_score: c.score.credit_score, latest_risk_level: c.score.risk_level, latest_fraud_score: c.fraud.fraud_score, updated_at: new Date().toISOString(),
  });
  audit(c.record.id, "analysis.completed", `Full analysis: score ${c.score.credit_score}, ${c.score.decision.replace(/_/g, " ").toLowerCase()}`);
}

// ---------------------------------------------------------------- copilot
function answer(question: string, caseId: string | null): string {
  const c = caseId ? store.cases.get(caseId) : null;
  const q = question.toLowerCase();
  if (!c) {
    const list = [...store.cases.values()].filter((x) => x.score).sort((a, z) => (z.score!.credit_score - a.score!.credit_score));
    return [
      "**Portfolio snapshot** (demo data)",
      ...list.map((x) => `- **${x.record.company.name}** — score ${x.score!.credit_score} (${x.score!.rating}), ${x.score!.decision.replace(/_/g, " ").toLowerCase()}, fraud ${x.fraud?.fraud_score}/100`),
      "",
      "Open a case to ask about its drivers, fraud graph, pricing or CAM.",
    ].join("\n");
  }
  const s = c.score, f = c.fraud, r = c.research, name = c.record.company.name;
  if (!s) return `${name} has not been analysed yet. Upload documents and run **Full analysis** first.`;
  if (/fraud|circular|shell|graph|gst|itc/.test(q)) {
    return [`**Fraud view for ${name}: ${f?.risk_level} (${f?.fraud_score}/100)**`, f?.summary ?? "", "", ...(f?.alerts ?? []).slice(0, 4).map((a) => `- **${a.severity}** · ${a.title} — ${a.description}`), "", "**GST checks**", ...(f?.gst_checks ?? []).map((g) => `- ${g.check}: ${g.status.toUpperCase()} — ${g.detail}`)].join("\n");
  }
  if (/rate|pric|interest|spread/.test(q)) {
    return [`**Suggested rate: ${s.suggested_rate.toFixed(2)}% p.a.** (${s.pricing.grade})`, ...s.pricing.components.map((x) => `- ${x.component}: ${x.bps} bps — ${x.rationale}`)].join("\n");
  }
  if (/amount|limit|how much|sizing|sanction/.test(q)) {
    return [`**Recommended: ₹${(s.recommended_amount / CR).toFixed(2)} Cr** of ₹${(s.loan_sizing.requested_amount / CR).toFixed(2)} Cr requested. Binding constraint: ${s.loan_sizing.binding_constraint}.`, ...s.loan_sizing.methods.map((m) => `- ${m.method}: ₹${(m.limit / CR).toFixed(2)} Cr — ${m.basis}`)].join("\n");
  }
  if (/litig|legal|nclt|court|news|media|sector|rbi/.test(q)) {
    return [`**External intelligence** — litigation ${r?.litigation_risk}, sentiment ${r?.promoter_sentiment}, sector ${r?.sector_outlook}`, r?.summary ?? "", "", ...(r?.findings ?? []).slice(0, 4).map((x) => `- ${x.title} *(${x.source})*`)].join("\n");
  }
  if (/condition|covenant|mitig|improve|what if/.test(q)) {
    const lines = s.what_if.map((w) => `- ${w.label}: ${w.current} → ${w.target} would add ~${w.score_gain} pts`);
    return [`**What would move the decision**`, ...lines, "", `**Proposed conditions**`, ...(s.conditions.length ? s.conditions.map((x) => `- ${x}`) : ["- Not applicable — the recommendation is to decline."])].join("\n");
  }
  const neg = s.contributions.filter((x) => x.points < 0).slice(0, 3);
  const pos = s.contributions.filter((x) => x.points > 0).slice(0, 2);
  return [
    `**${name}: ${s.credit_score} (${s.rating}) → ${s.decision.replace(/_/g, " ").toLowerCase()}**`,
    `PD ${(s.probability_of_default * 100).toFixed(2)}% · model ${s.model_score}, overlays ${s.overlay_total >= 0 ? "+" : ""}${s.overlay_total}.`,
    "", "**What pulls the score down**", ...neg.map((x) => `- ${x.description} (${x.points} pts)`),
    "", "**What supports it**", ...pos.map((x) => `- ${x.description} (+${x.points} pts)`),
    ...(s.policy.knockouts.length ? ["", `**Policy knock-out:** ${s.policy.knockouts.map((k) => k.name).join(", ")}`] : []),
  ].join("\n");
}

// ---------------------------------------------------------------- router
type Handler = (m: RegExpMatchArray, body: any, query: URLSearchParams) => unknown | Promise<unknown>;
const routes: [string, RegExp, Handler][] = [];
const on = (method: string, pattern: string, h: Handler) =>
  routes.push([method, new RegExp(`^${pattern.replace(/:[a-z_]+/g, "([^/]+)")}$`), h]);

const token = (u: User) => ({ access_token: `demo.${u.id}.${Date.now()}`, expires_in: 12 * 3600, user: u });

on("POST", "/auth/login", (_m, body) => {
  const u = store.users.find((x) => x.email.toLowerCase() === String(body?.email ?? "").toLowerCase()) ?? USERS[0];
  return token(u);
});
on("POST", "/auth/register", (_m, body) => {
  const u: User = { id: `u-${uid()}`, email: body.email, full_name: body.full_name, role: "analyst", is_active: true, created_at: new Date().toISOString(), last_login_at: null };
  store.users.push(u);
  return token(u);
});
on("GET", "/auth/me", () => me());
on("GET", "/users", () => store.users);
on("POST", "/users", (_m, b) => { const u: User = { id: `u-${uid()}`, email: b.email, full_name: b.full_name, role: b.role, is_active: true, created_at: new Date().toISOString(), last_login_at: null }; store.users.push(u); return u; });
on("PATCH", "/users/:id", (m, b) => { const u = store.users.find((x) => x.id === m[1]); if (!u) throw new DemoError(404, "NOT_FOUND", "User not found"); Object.assign(u, b); return u; });
on("GET", "/companies", () => [...store.cases.values()].map((c) => c.record.company));
on("GET", "/meta/sectors", () => ["food_processing", "pharmaceuticals", "infrastructure_epc", "textiles", "auto_components", "chemicals", "steel_metals", "it_services", "renewable_energy", "nbfc", "real_estate", "hospitality", "manufacturing"].map((key) => ({ key, name: key.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()) })));

on("GET", "/dashboard/summary", () => {
  const cases = [...store.cases.values()];
  const d = buildDashboard(cases.map((c) => c.record), Object.fromEntries(cases.map((c) => [c.record.id, c.fraud])));
  d.active_jobs = [...store.jobs.values()].filter((j) => jobView(j).status === "running").length;
  return { ...d, recent_activity: auditFeed().slice(0, 12) };
});

on("GET", "/cases", (_m, _b, q) => {
  let items = [...store.cases.values()].map((c) => c.record);
  const term = (q.get("q") ?? "").toLowerCase();
  if (term) items = items.filter((c) => `${c.company.name} ${c.reference} ${c.company.gstin}`.toLowerCase().includes(term));
  if (q.get("status")) items = items.filter((c) => q.get("status")!.split(",").includes(c.status));
  if (q.get("risk")) items = items.filter((c) => c.latest_risk_level === q.get("risk"));
  items.sort((a, z) => z.updated_at.localeCompare(a.updated_at));
  return { items, total: items.length, limit: 200, offset: 0 };
});
on("POST", "/cases", (_m, b) => {
  const template = PORTFOLIO[0];
  const n = store.cases.size + 1;
  const key = `new-${uid()}`;
  const spec: DemoBorrower = {
    ...structuredClone(template), key, reference: `CX-2026-${String(n).padStart(4, "0")}`, status: "draft", updatedHoursAgo: 0,
    company: { ...template.company, name: b.company?.name ?? b.company_name ?? "New Borrower Private Limited", cin: b.company?.cin ?? "U00000MH2020PTC000000", pan: b.company?.pan ?? "AAAAA0000A", gstin: b.company?.gstin ?? "27AAAAA0000A1Z5", sector: b.company?.sector ?? "manufacturing", city: b.company?.city ?? "Mumbai", state: b.company?.state ?? "Maharashtra", promoters: [] },
    facility: { ...template.facility, facility_type: b.facility_type ?? "Term Loan", requested: Number(b.requested_amount) || 10 * CR, tenure_months: Number(b.tenure_months) || 60, purpose: b.purpose ?? "", collateral_type: b.collateral_type ?? "", collateral_value: Number(b.collateral_value) || 0 },
    notes: [], fraudAlerts: [],
  };
  const state = addCase(spec, false);
  audit(key, "case.created", `Case opened for ${spec.company.name}`);
  return state.record;
});
on("GET", "/cases/:id", (m) => getCase(m[1]).record);
on("PATCH", "/cases/:id", (m, b) => Object.assign(getCase(m[1]).record, b, { updated_at: new Date().toISOString() }));
on("GET", "/cases/:id/overview", (m) => {
  const c = getCase(m[1]);
  const activeJobs = [...store.jobs.values()].filter((j) => j.case_id === c.record.id).map(jobView).filter((j) => j.status === "running");
  if (!c.analyzed) {
    return {
      company: c.record.company, case: { reference: c.record.reference, status: c.record.status }, case_record: c.record, score: null, research: null, fraud: null,
      facts: { bank: [], gst: [], legal: [], documents: c.docs.map((d) => ({ id: d.id, filename: d.filename, doc_type: d.doc_type ?? "unknown", confidence: d.extraction_confidence ?? 0 })), red_flags: [], positive_signals: [], shareholding: null },
      notes: c.notes.map((n) => ({ id: n.id, body: n.body, effective_impact: n.impact_points, category: n.category, author: n.author?.full_name ?? null, created_at: n.created_at })),
      active_jobs: activeJobs, financials: {}, latest_cam_version: 0,
    };
  }
  const o = buildOverview(c.spec, { score: c.score!, research: c.research!, fraud: c.fraud!, docs: c.docs, notes: c.notes, caseRecord: c.record });
  o.active_jobs = activeJobs;
  o.latest_cam_version = c.cam?.version ?? 0;
  return o;
});
const caseJob = (kind: Job["kind"], ms: number, after: (c: CaseState) => void) => (m: RegExpMatchArray) => {
  const c = getCase(m[1]);
  if (kind === "full_analysis" && !c.docs.length) throw new DemoError(422, "VALIDATION_FAILED", "Upload at least one document before running analysis");
  if (kind === "full_analysis") c.record.status = "analyzing";
  audit(c.record.id, `job.${kind}`, `${kind.replace(/_/g, " ")} started`);
  return startJob(kind, c.record.id, ms, () => after(c));
};
on("POST", "/cases/:id/analyze", caseJob("full_analysis", 9000, runAnalysis));
on("POST", "/cases/:id/score", caseJob("score", 3200, (c) => { if (c.analyzed) { c.score = buildScore(c.spec); c.score.version += 1; } }));
on("POST", "/cases/:id/research", caseJob("research", 4200, (c) => { if (c.analyzed) c.research = buildResearch(c.spec); }));
on("POST", "/cases/:id/fraud", caseJob("fraud", 3800, (c) => { if (c.analyzed) c.fraud = buildFraud(c.spec); }));
on("POST", "/cases/:id/decision", (m, b) => {
  const c = getCase(m[1]);
  Object.assign(c.record, { final_decision: b.decision, decision_rationale: b.rationale, decided_at: new Date().toISOString(), status: b.decision === "DECLINE" ? "rejected" : b.decision === "REFER" ? "escalated" : "approved", updated_at: new Date().toISOString() });
  audit(c.record.id, "case.decided", `Final decision: ${String(b.decision).replace(/_/g, " ").toLowerCase()}`);
  return c.record;
});
on("GET", "/cases/:id/timeline", (m) => {
  const c = getCase(m[1]);
  const live = store.audit.filter((a) => a.case_id === c.record.id).map((a) => ({ type: "audit" as const, at: a.created_at, actor: a.actor_email, action: a.action, summary: a.summary }));
  return [...live, ...(c.analyzed ? buildTimeline(c.spec) : [])];
});
on("GET", "/cases/:id/audit", (m) => store.audit.filter((a) => a.case_id === m[1]));
const auditFeed = (caseId?: string | null) => store.audit.filter((a) => !caseId || a.case_id === caseId).concat(
  [...store.cases.values()].filter((c) => c.analyzed).flatMap((c) => buildTimeline(c.spec).filter((t) => t.type === "audit").map((t, i) => ({ id: `${c.record.id}-a${i}`, created_at: t.at, actor_email: t.actor, action: t.action, entity_type: "case", entity_id: c.record.id, case_id: c.record.id, summary: t.summary, details: {}, request_id: null }))),
).sort((a, z) => z.created_at.localeCompare(a.created_at));
on("GET", "/audit", (_m, _b, q) => auditFeed(q.get("case_id")));

on("GET", "/cases/:id/documents", (m) => getCase(m[1]).docs);
on("GET", "/documents/:id", (m) => {
  for (const c of store.cases.values()) {
    const d = c.docs.find((x) => x.id === m[1]);
    if (d) return buildDocumentDetail(c.spec, d);
  }
  throw new DemoError(404, "NOT_FOUND", "Document not found");
});
on("POST", "/documents/:id/reprocess", (m) => {
  for (const c of store.cases.values()) {
    const d = c.docs.find((x) => x.id === m[1]);
    if (d) { d.status = "processing"; return startJob("ingest_document", c.record.id, 3500, () => { d.status = "processed"; }); }
  }
  throw new DemoError(404, "NOT_FOUND", "Document not found");
});
on("GET", "/cases/:id/financials", (m) => { const c = getCase(m[1]); if (!c.analyzed) return { statements: [], ratios: { latest_year: null, latest: {}, trend: [] } }; return buildFinancials(c.spec, c.score!); });
on("PUT", "/cases/:id/financials/:fy", (m, b) => { audit(m[1], "financials.edited", `${m[2]} values edited: ${b.reason}`); return { ok: true }; });
on("GET", "/cases/:id/research", (m) => getCase(m[1]).research);
on("GET", "/cases/:id/fraud", (m) => getCase(m[1]).fraud);
on("GET", "/cases/:id/fraud/cypher", () => "MERGE (b:Company {key: 'borrower'})\n// … demo export");
on("PATCH", "/fraud/alerts/:id", (m, b) => {
  for (const c of store.cases.values()) {
    const a = c.fraud?.alerts.find((x) => x.id === m[1]);
    if (a) { a.status = b.status; audit(c.record.id, "fraud.alert_reviewed", `${a.title} marked ${b.status}`); return a; }
  }
  throw new DemoError(404, "NOT_FOUND", "Alert not found");
});
on("GET", "/cases/:id/score", (m) => getCase(m[1]).score);
on("GET", "/cases/:id/scores", (m) => {
  const s = getCase(m[1]).score;
  if (!s) return [];
  return [
    { version: 1, credit_score: s.credit_score - 9, model_score: s.model_score, decision: s.decision, overlay_total: s.overlay_total - 9, created_at: ago(40) },
    { version: 2, credit_score: s.credit_score, model_score: s.model_score, decision: s.decision, overlay_total: s.overlay_total, created_at: s.created_at },
  ];
});
on("GET", "/model/info", () => ({ version: "xgb-202610-mono", model_type: "xgboost", metrics: { auc: 0.884, gini: 0.769, ks: 0.611, brier: 0.0907 }, features: 18, monotone: true, explainer: "shap-treeexplainer" }));

on("GET", "/cases/:id/cam", (m) => getCase(m[1]).cam);
on("POST", "/cases/:id/cam", (m) => {
  const c = getCase(m[1]);
  if (!c.analyzed) throw new DemoError(422, "VALIDATION_FAILED", "Run analysis before generating a CAM");
  return startJob("cam", c.record.id, 3600, () => {
    const prev = c.cam?.version ?? 0;
    c.cam = buildCam(c.spec, c.score!, c.research!, c.fraud!, c.camComments);
    c.cam.version = prev + 1;
    c.cam.versions = Array.from({ length: prev + 1 }, (_, i) => i + 1);
    audit(c.record.id, "cam.generated", `CAM v${c.cam.version} generated`);
  });
});
on("PUT", "/cases/:id/cam/comments", (m, b) => {
  const c = getCase(m[1]);
  c.camComments = { ...c.camComments, ...b.comments };
  if (c.cam) c.cam.sections.forEach((s) => (s.analyst_comment = c.camComments[s.id] ?? s.analyst_comment));
  return { saved: true };
});

on("GET", "/cases/:id/notes", (m) => getCase(m[1]).notes);
on("POST", "/cases/:id/notes", (m, b) => {
  const c = getCase(m[1]);
  const impact = previewImpact(b.body).points;
  const n: Note = { id: `note-${uid()}`, case_id: c.record.id, parent_id: b.parent_id ?? null, kind: b.kind ?? "note", category: b.category ?? "general", body: b.body, impact_points: b.kind === "comment" ? null : impact, inferred_impact: impact, impact_rationale: previewImpact(b.body).rationale, five_c: previewImpact(b.body).five_c, include_in_cam: b.include_in_cam ?? true, pinned: false, author: me(), created_at: new Date().toISOString(), preview_impact: null, preview_rationale: null };
  c.notes.unshift(n);
  if (n.impact_points && c.score) {
    c.score.overlays.unshift({ source: "analyst_note", label: n.body.slice(0, 68), points: n.impact_points, rationale: n.impact_rationale ?? "", five_c: n.five_c ?? "character", reference_id: n.id });
    c.score.overlay_total += n.impact_points;
    c.score.credit_score = Math.max(300, Math.min(900, c.score.credit_score + n.impact_points));
    c.record.latest_score = c.score.credit_score;
  }
  audit(c.record.id, "note.added", n.body.slice(0, 80));
  return n;
});
on("PATCH", "/notes/:id", (m, b) => { for (const c of store.cases.values()) { const n = c.notes.find((x) => x.id === m[1]); if (n) return Object.assign(n, b); } throw new DemoError(404, "NOT_FOUND", "Note not found"); });
on("DELETE", "/notes/:id", (m) => { for (const c of store.cases.values()) c.notes = c.notes.filter((x) => x.id !== m[1]); return undefined; });
function previewImpact(body: string) {
  const t = body.toLowerCase();
  const cap = t.match(/(\d{1,3})\s*%\s*capacity|capacity[^.\d]{0,20}(\d{1,3})\s*%/);
  if (cap) { const p = Number(cap[1] ?? cap[2]); const pts = p < 50 ? -20 : p < 70 ? -10 : p >= 85 ? 6 : 0; return { points: pts, inferred_points: pts, five_c: "capacity", rationale: `Capacity utilisation of ${p}% ${pts < 0 ? "weakens" : "supports"} repayment capacity.` }; }
  if (/evasive|uncooperative|refused|divers/.test(t)) return { points: -15, inferred_points: -15, five_c: "character", rationale: "Governance concern raised in field observation." };
  if (/strong order|new order|contract won|well maintained|cooperative|infus/.test(t)) return { points: 5, inferred_points: 5, five_c: "capacity", rationale: "Positive operational signal." };
  if (/delay|overdue|idle|strike|unrest|title dispute/.test(t)) return { points: -8, inferred_points: -8, five_c: "capacity", rationale: "Operational stress signal." };
  return { points: 0, inferred_points: 0, five_c: "character", rationale: "No quantifiable credit signal detected." };
}
on("POST", "/notes/preview-impact", (_m, b) => previewImpact(String(b.body ?? "")));

on("GET", "/cases/:id/overrides", (m) => getCase(m[1]).overrides);
on("POST", "/cases/:id/overrides", (m, b) => {
  const c = getCase(m[1]);
  const o: Override = { id: `ovr-${uid()}`, case_id: c.record.id, field: b.field, original_value: b.field === "decision" ? c.score?.decision ?? null : b.field === "amount" ? String(c.score?.recommended_amount ?? "") : String(c.score?.suggested_rate ?? ""), new_value: b.new_value, reason: b.reason, status: "pending", requested_by: me(), reviewed_by: null, reviewed_at: null, review_comment: null, created_at: new Date().toISOString() };
  c.overrides.unshift(o);
  audit(c.record.id, "override.requested", `${b.field} → ${b.new_value}`);
  return o;
});
on("POST", "/overrides/:id/review", (m, b) => { for (const c of store.cases.values()) { const o = c.overrides.find((x) => x.id === m[1]); if (o) return Object.assign(o, { status: b.approve ? "approved" : "rejected", reviewed_by: me(), reviewed_at: new Date().toISOString(), review_comment: b.comment ?? null }); } throw new DemoError(404, "NOT_FOUND", "Override not found"); });
on("GET", "/cases/:id/escalations", (m) => getCase(m[1]).escalations);
on("POST", "/cases/:id/escalations", (m, b) => {
  const c = getCase(m[1]);
  const e: Escalation = { id: `esc-${uid()}`, case_id: c.record.id, to_role: "credit_manager", reason: b.reason, status: "open", resolution: null, raised_by: me(), resolved_by: null, resolved_at: null, created_at: new Date().toISOString() };
  c.escalations.unshift(e);
  c.record.status = "escalated";
  audit(c.record.id, "case.escalated", b.reason);
  return e;
});
on("POST", "/escalations/:id/resolve", (m, b) => { for (const c of store.cases.values()) { const e = c.escalations.find((x) => x.id === m[1]); if (e) { c.record.status = "in_review"; return Object.assign(e, { status: "resolved", resolution: b.resolution, resolved_by: me(), resolved_at: new Date().toISOString() }); } } throw new DemoError(404, "NOT_FOUND", "Escalation not found"); });

on("POST", "/copilot/chat", async (_m, b) => {
  await sleep(500 + Math.random() * 600);
  const caseId = b.case_id ?? null;
  const text = answer(String(b.message ?? ""), caseId);
  const now = new Date().toISOString();
  store.chat.push({ id: uid(), case_id: caseId, role: "user", content: b.message, provider: null, created_at: now });
  const id = uid();
  store.chat.push({ id, case_id: caseId, role: "assistant", content: text, provider: "local", created_at: now });
  const reply: ChatReply = { answer: text, provider: "local", model: "credx-grounded-v1", input_tokens: 0, output_tokens: 0, latency_ms: 640, fallback_used: false, message_id: id };
  return reply;
});
on("GET", "/copilot/history", (_m, _b, q) => store.chat.filter((x) => x.case_id === (q.get("case_id") ?? null)));
on("GET", "/copilot/providers", () => ({ order: ["anthropic", "openai", "gemini", "local"], active: ["local"], models: { anthropic: "claude-opus-5-5", openai: "gpt-4o-mini", gemini: "gemini-1.5-flash", local: "credx-grounded-v1" } }));

on("GET", "/jobs", (_m, _b, q) => {
  const statuses = q.get("status")?.split(",");
  return [...store.jobs.values()].map(jobView)
    .filter((j) => (!q.get("case_id") || j.case_id === q.get("case_id")) && (!statuses || statuses.includes(j.status)))
    .sort((a, z) => z.created_at.localeCompare(a.created_at));
});
on("GET", "/jobs/:id", (m) => { const j = store.jobs.get(m[1]); if (!j) throw new DemoError(404, "NOT_FOUND", "Job not found"); return jobView(j); });

// ---------------------------------------------------------------- entry points
export async function demoRequest(path: string, method: string, body: unknown): Promise<{ status: number; data: unknown; error?: { code: string; message: string } }> {
  seed();
  await sleep(120 + Math.random() * 180);
  const [pathname, qs = ""] = path.split("?");
  const query = new URLSearchParams(qs);
  for (const [m, re, h] of routes) {
    if (m !== method) continue;
    const match = pathname.match(re);
    if (!match) continue;
    try {
      return { status: 200, data: await h(match, body, query) };
    } catch (e) {
      if (e instanceof DemoError) return { status: e.status, data: null, error: { code: e.code, message: e.message } };
      throw e;
    }
  }
  return { status: 404, data: null, error: { code: "NOT_FOUND", message: `Demo mode has no handler for ${method} ${pathname}` } };
}

export async function demoUpload(path: string, form: FormData, onProgress: (p: number) => void) {
  seed();
  const caseId = path.split("/")[2];
  const c = getCase(caseId);
  const files = form.getAll("files") as File[];
  for (let p = 0; p <= 100; p += 10) {
    onProgress(p);
    await sleep(70);
  }
  const typeFor = (n: string) => (/gst/i.test(n) ? "gst_return" : /bank|statement/i.test(n) ? "bank_statement" : /legal|notice|nclt/i.test(n) ? "legal_notice" : /sanction/i.test(n) ? "sanction_letter" : /mca|roc/i.test(n) ? "mca_filing" : /share/i.test(n) ? "shareholding_pattern" : "annual_report");
  const documents: DocumentRecord[] = files.map((f) => ({
    id: `doc-${uid()}`, case_id: caseId, filename: f.name, content_type: f.type || "application/pdf", size_bytes: f.size, declared_type: null,
    doc_type: typeFor(f.name), classification_confidence: 0.9, classification_signals: [typeFor(f.name).replace(/_/g, " ")], status: "processing",
    page_count: Math.max(1, Math.round(f.size / 60_000)), ocr_used: false, extraction_confidence: 0.88, error: null, created_at: new Date().toISOString(),
  }));
  c.docs.unshift(...documents);
  if (c.record.status === "draft") c.record.status = "ingesting";
  const jobs = documents.map((d) => startJob("ingest_document", caseId, 2500 + Math.random() * 2000, () => { d.status = "processed"; }));
  if (form.get("auto_analyze") === "true") {
    jobs.push(startJob("full_analysis", caseId, 9000, () => runAnalysis(c)));
    c.record.status = "analyzing";
  }
  audit(caseId, "documents.uploaded", `${files.length} document(s) uploaded`);
  return { documents, jobs, rejected: [] };
}

export function demoDownload(path: string): { blob: Blob; name: string } {
  seed();
  const camId = path.match(/\/cam\/([^/]+)\/download/)?.[1];
  if (camId) {
    const c = [...store.cases.values()].find((x) => x.cam?.id === camId);
    const cam = c?.cam;
    const html = `<!doctype html><meta charset="utf-8"><title>CAM — ${c?.record.company.name}</title><body style="font-family:system-ui;max-width:860px;margin:32px auto;line-height:1.5"><h1>Credit Appraisal Memo — ${c?.record.company.name}</h1><p><em>Demo mode export (fictional data). PDF/DOCX exports are produced by the backend.</em></p>${cam?.sections.map((s) => `<h2>${s.title}</h2><pre style="white-space:pre-wrap;font-family:inherit">${typeof s.content === "string" ? s.content : JSON.stringify(s.content, null, 2)}</pre>`).join("") ?? ""}</body>`;
    return { blob: new Blob([html], { type: "text/html" }), name: `CAM-${c?.record.reference ?? "demo"}.html` };
  }
  return { blob: new Blob(["Demo mode: original documents are not stored in the browser."], { type: "text/plain" }), name: "document-demo.txt" };
}
