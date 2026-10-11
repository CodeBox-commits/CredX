"use client";

import type {
  AuditEntry, Cam, CaseOverview, ChatReply, Company, CreditCase, DashboardSummary, DocumentDetail, DocumentRecord,
  Escalation, FinancialsResponse, Fraud, Job, Note, Override, Page, Research, Score, TimelineEvent, TokenResponse, User,
} from "@/types/api";

import { download, request, uploadWithProgress } from "./client";

export const api = {
  auth: {
    login: (email: string, password: string) => request<TokenResponse>("/auth/login", { method: "POST", body: { email, password } }),
    register: (email: string, password: string, full_name: string) =>
      request<TokenResponse>("/auth/register", { method: "POST", body: { email, password, full_name } }),
    me: () => request<User>("/auth/me"),
  },
  users: {
    list: () => request<User[]>("/users"),
    create: (body: { email: string; password: string; full_name: string; role: string }) => request<User>("/users", { method: "POST", body }),
    update: (id: string, body: Partial<Pick<User, "role" | "is_active" | "full_name">>) => request<User>(`/users/${id}`, { method: "PATCH", body }),
  },
  companies: {
    list: (q?: string) => request<Company[]>(`/companies${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  },
  cases: {
    list: (params: { q?: string; status?: string; risk?: string; limit?: number } = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
      return request<Page<CreditCase>>(`/cases?${qs}`);
    },
    get: (id: string) => request<CreditCase>(`/cases/${id}`),
    overview: (id: string) => request<CaseOverview>(`/cases/${id}/overview`),
    create: (body: Record<string, unknown>) => request<CreditCase>("/cases", { method: "POST", body }),
    update: (id: string, body: Record<string, unknown>) => request<CreditCase>(`/cases/${id}`, { method: "PATCH", body }),
    analyze: (id: string) => request<Job>(`/cases/${id}/analyze`, { method: "POST" }),
    rescore: (id: string) => request<Job>(`/cases/${id}/score`, { method: "POST" }),
    research: (id: string) => request<Job>(`/cases/${id}/research`, { method: "POST" }),
    fraud: (id: string) => request<Job>(`/cases/${id}/fraud`, { method: "POST" }),
    decide: (id: string, decision: string, rationale: string) =>
      request<CreditCase>(`/cases/${id}/decision`, { method: "POST", body: { decision, rationale } }),
    timeline: (id: string) => request<TimelineEvent[]>(`/cases/${id}/timeline`),
    audit: (id: string) => request<AuditEntry[]>(`/cases/${id}/audit`),
  },
  documents: {
    list: (caseId: string) => request<DocumentRecord[]>(`/cases/${caseId}/documents`),
    get: (id: string) => request<DocumentDetail>(`/documents/${id}`),
    upload: (caseId: string, files: File[], opts: { autoAnalyze?: boolean; declaredType?: string }, onProgress: (p: number) => void) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("auto_analyze", String(!!opts.autoAnalyze));
      if (opts.declaredType) form.append("declared_type", opts.declaredType);
      return uploadWithProgress<{ documents: DocumentRecord[]; jobs: Job[]; rejected: { filename: string; reason: string }[] }>(
        `/cases/${caseId}/documents`, form, onProgress);
    },
    reprocess: (id: string, declaredType?: string) =>
      request<Job>(`/documents/${id}/reprocess${declaredType ? `?declared_type=${declaredType}` : ""}`, { method: "POST" }),
    download: (id: string, name: string) => download(`/documents/${id}/file`, name),
  },
  financials: {
    get: (caseId: string) => request<FinancialsResponse>(`/cases/${caseId}/financials`),
    update: (caseId: string, fy: string, values: Record<string, number | null>, reason: string) =>
      request(`/cases/${caseId}/financials/${fy}`, { method: "PUT", body: { values, reason } }),
  },
  research: { get: (caseId: string) => request<Research | null>(`/cases/${caseId}/research`) },
  fraud: {
    get: (caseId: string) => request<Fraud | null>(`/cases/${caseId}/fraud`),
    updateAlert: (id: string, status: string, comment?: string) => request(`/fraud/alerts/${id}`, { method: "PATCH", body: { status, comment } }),
    cypher: (caseId: string) => request<string>(`/cases/${caseId}/fraud/cypher`),
  },
  score: {
    get: (caseId: string) => request<Score | null>(`/cases/${caseId}/score`),
    history: (caseId: string) => request<{ version: number; credit_score: number; model_score: number; decision: string; overlay_total: number; created_at: string }[]>(`/cases/${caseId}/scores`),
    model: () => request<Record<string, any>>("/model/info"),
  },
  cam: {
    get: (caseId: string, version?: number) => request<Cam | null>(`/cases/${caseId}/cam${version ? `?version=${version}` : ""}`),
    generate: (caseId: string) => request<Job>(`/cases/${caseId}/cam`, { method: "POST" }),
    saveComments: (caseId: string, comments: Record<string, string>, regenerate: boolean) =>
      request<{ job?: Job; saved?: boolean }>(`/cases/${caseId}/cam/comments`, { method: "PUT", body: { comments, regenerate } }),
    download: (camId: string, format: "pdf" | "docx" | "html", name: string) => download(`/cam/${camId}/download?format=${format}`, name),
  },
  notes: {
    list: (caseId: string) => request<Note[]>(`/cases/${caseId}/notes`),
    create: (caseId: string, body: Record<string, unknown>) => request<Note>(`/cases/${caseId}/notes`, { method: "POST", body }),
    update: (id: string, body: Record<string, unknown>) => request<Note>(`/notes/${id}`, { method: "PATCH", body }),
    remove: (id: string) => request<void>(`/notes/${id}`, { method: "DELETE" }),
    preview: (body: string) => request<{ points: number; inferred_points: number; five_c: string; rationale: string }>("/notes/preview-impact", { method: "POST", body: { body } }),
  },
  overrides: {
    list: (caseId: string) => request<Override[]>(`/cases/${caseId}/overrides`),
    create: (caseId: string, body: { field: string; new_value: string; reason: string }) =>
      request<Override>(`/cases/${caseId}/overrides`, { method: "POST", body }),
    review: (id: string, approve: boolean, comment?: string) => request<Override>(`/overrides/${id}/review`, { method: "POST", body: { approve, comment } }),
  },
  escalations: {
    list: (caseId: string) => request<Escalation[]>(`/cases/${caseId}/escalations`),
    create: (caseId: string, reason: string) => request<Escalation>(`/cases/${caseId}/escalations`, { method: "POST", body: { reason } }),
    resolve: (id: string, resolution: string) => request<Escalation>(`/escalations/${id}/resolve`, { method: "POST", body: { resolution } }),
  },
  copilot: {
    chat: (message: string, caseId?: string | null) => request<ChatReply>("/copilot/chat", { method: "POST", body: { message, case_id: caseId ?? null } }),
    history: (caseId?: string | null) => request<{ id: string; role: "user" | "assistant"; content: string; provider: string | null; created_at: string }[]>(
      `/copilot/history${caseId ? `?case_id=${caseId}` : ""}`),
    providers: () => request<{ order: string[]; active: string[]; models: Record<string, string> }>("/copilot/providers"),
  },
  jobs: {
    list: (params: { case_id?: string; status?: string; limit?: number } = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, String(v)]));
      return request<Job[]>(`/jobs?${qs}`);
    },
    get: (id: string) => request<Job>(`/jobs/${id}`),
  },
  audit: { list: (params: { case_id?: string; action?: string } = {}) => request<AuditEntry[]>(`/audit?${new URLSearchParams(params as Record<string, string>)}`) },
  dashboard: () => request<DashboardSummary>("/dashboard/summary"),
  sectors: () => request<{ key: string; name: string }[]>("/meta/sectors"),
};
