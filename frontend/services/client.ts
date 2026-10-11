"use client";

import { useAuth } from "@/store/auth";

// Same-origin by default (Next rewrites /api/v1 -> FastAPI). Set NEXT_PUBLIC_API_URL to call the API directly.
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "/api/v1").replace(/\/$/, "");

/** NEXT_PUBLIC_DEMO_MODE=true serves fictional fixtures from an in-browser mock API (no backend needed). */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const demo = () => import("./demo/handler");

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public requestId?: string,
  ) {
    super(message);
  }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; raw?: boolean };

export async function request<T>(path: string, opts: Options = {}): Promise<T> {
  if (DEMO_MODE) {
    const { demoRequest } = await demo();
    const res = await demoRequest(path, (opts.method ?? "GET").toUpperCase(), opts.body);
    if (res.error) throw new ApiError(res.status, res.error.code, res.error.message);
    return res.data as T;
  }
  const token = useAuth.getState().token;
  const headers = new Headers(opts.headers);
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers,
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the CredX API. Is the backend running?");
  }
  if (res.status === 401 && token) {
    useAuth.getState().logout();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
  }
  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON error */
    }
    const err = body?.error;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? res.statusText, err?.details, err?.request_id);
  }
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? res.json() : res.text()) as Promise<T>;
}

/** Download an authenticated file (CAM PDF/DOCX, original documents). */
export async function download(path: string, fallbackName: string): Promise<void> {
  let blob: Blob;
  let name = fallbackName;
  if (DEMO_MODE) {
    ({ blob, name } = (await demo()).demoDownload(path));
  } else {
    const res = await request<Response>(path, { raw: true });
    blob = await res.blob();
    const disposition = res.headers.get("content-disposition") ?? "";
    name = disposition.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackName;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** XHR upload so we get real byte-level progress (fetch has no upload progress). */
export function uploadWithProgress<T>(path: string, form: FormData, onProgress: (pct: number) => void): Promise<T> {
  if (DEMO_MODE) return demo().then((d) => d.demoUpload(path, form, onProgress) as Promise<T>);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    const token = useAuth.getState().token;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else reject(new ApiError(xhr.status, body?.error?.code ?? "upload_failed", body?.error?.message ?? "Upload failed", body?.error?.details));
    };
    xhr.onerror = () => reject(new ApiError(0, "network_error", "Upload failed — network error"));
    xhr.send(form);
  });
}
