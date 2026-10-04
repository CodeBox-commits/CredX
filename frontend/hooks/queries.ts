"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { api } from "@/services/api";
import { ApiError } from "@/services/client";
import type { Job } from "@/types/api";

export const qk = {
  dashboard: ["dashboard"] as const,
  cases: (params?: object) => ["cases", params ?? {}] as const,
  case: (id: string) => ["case", id] as const,
  overview: (id: string) => ["case", id, "overview"] as const,
  documents: (id: string) => ["case", id, "documents"] as const,
  document: (id: string) => ["document", id] as const,
  financials: (id: string) => ["case", id, "financials"] as const,
  research: (id: string) => ["case", id, "research"] as const,
  fraud: (id: string) => ["case", id, "fraud"] as const,
  score: (id: string) => ["case", id, "score"] as const,
  scoreHistory: (id: string) => ["case", id, "score-history"] as const,
  cam: (id: string, v?: number) => ["case", id, "cam", v ?? "latest"] as const,
  notes: (id: string) => ["case", id, "notes"] as const,
  overrides: (id: string) => ["case", id, "overrides"] as const,
  escalations: (id: string) => ["case", id, "escalations"] as const,
  timeline: (id: string) => ["case", id, "timeline"] as const,
  jobs: (params?: object) => ["jobs", params ?? {}] as const,
  job: (id: string) => ["job", id] as const,
};

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Something went wrong");

export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: api.dashboard, refetchInterval: 15_000 });
export const useCases = (params: { q?: string; status?: string; risk?: string } = {}) =>
  useQuery({ queryKey: qk.cases(params), queryFn: () => api.cases.list({ ...params, limit: 200 }) });
export const useOverview = (id: string) => useQuery({ queryKey: qk.overview(id), queryFn: () => api.cases.overview(id) });
export const useDocuments = (id: string) =>
  useQuery({
    queryKey: qk.documents(id),
    queryFn: () => api.documents.list(id),
    refetchInterval: (q) => (q.state.data?.some((d) => d.status === "uploaded" || d.status === "processing") ? 1500 : false),
  });
export const useDocument = (id: string | null) =>
  useQuery({ queryKey: qk.document(id ?? ""), queryFn: () => api.documents.get(id!), enabled: !!id });
export const useFinancials = (id: string) => useQuery({ queryKey: qk.financials(id), queryFn: () => api.financials.get(id) });
export const useResearch = (id: string) => useQuery({ queryKey: qk.research(id), queryFn: () => api.research.get(id) });
export const useFraud = (id: string) => useQuery({ queryKey: qk.fraud(id), queryFn: () => api.fraud.get(id) });
export const useScore = (id: string) => useQuery({ queryKey: qk.score(id), queryFn: () => api.score.get(id) });
export const useScoreHistory = (id: string) => useQuery({ queryKey: qk.scoreHistory(id), queryFn: () => api.score.history(id) });
export const useCam = (id: string, version?: number) => useQuery({ queryKey: qk.cam(id, version), queryFn: () => api.cam.get(id, version) });
export const useNotes = (id: string) => useQuery({ queryKey: qk.notes(id), queryFn: () => api.notes.list(id) });
export const useOverrides = (id: string) => useQuery({ queryKey: qk.overrides(id), queryFn: () => api.overrides.list(id) });
export const useEscalations = (id: string) => useQuery({ queryKey: qk.escalations(id), queryFn: () => api.escalations.list(id) });
export const useTimeline = (id: string) => useQuery({ queryKey: qk.timeline(id), queryFn: () => api.cases.timeline(id) });

export const useJobs = (params: { case_id?: string; status?: string } = {}, live = true) =>
  useQuery({
    queryKey: qk.jobs(params),
    queryFn: () => api.jobs.list({ ...params, limit: 100 }),
    refetchInterval: (q) => (live && q.state.data?.some((j) => j.status === "queued" || j.status === "running") ? 1500 : live ? 8000 : false),
  });

const JOB_LABEL: Record<Job["kind"], string> = {
  ingest_document: "Document ingestion",
  research: "Secondary research",
  fraud: "Fraud analysis",
  score: "Credit scoring",
  cam: "CAM generation",
  full_analysis: "Full analysis",
};
export const jobLabel = (k: Job["kind"]) => JOB_LABEL[k] ?? k;

/** Poll a job until it settles; refresh everything for its case and toast the outcome. */
export function useJobWatcher(jobId: string | null, caseId?: string, onDone?: (job: Job) => void) {
  const qc = useQueryClient();
  const notified = useRef<string | null>(null);
  const query = useQuery({
    queryKey: qk.job(jobId ?? ""),
    queryFn: () => api.jobs.get(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data && ["succeeded", "failed"].includes(q.state.data.status) ? false : 900),
  });
  const job = query.data;
  useEffect(() => {
    if (!job || notified.current === job.id || !["succeeded", "failed"].includes(job.status)) return;
    notified.current = job.id;
    if (caseId) qc.invalidateQueries({ queryKey: ["case", caseId] });
    qc.invalidateQueries({ queryKey: ["cases"] });
    qc.invalidateQueries({ queryKey: qk.dashboard });
    if (job.status === "succeeded") toast.success(`${jobLabel(job.kind)} complete`, { description: job.duration_ms ? `${(job.duration_ms / 1000).toFixed(1)}s` : undefined });
    else toast.error(`${jobLabel(job.kind)} failed`, { description: job.error ?? undefined });
    onDone?.(job);
  }, [job, caseId, qc, onDone]);
  return job;
}

export function useCaseAction(caseId: string, action: "analyze" | "rescore" | "research" | "fraud", onJob: (job: Job) => void) {
  return useMutation({
    mutationFn: () => api.cases[action](caseId),
    onSuccess: (job) => {
      toast.message(`${jobLabel(job.kind)} started`, { description: "Running in the background — keep working." });
      onJob(job);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
