import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlatformAnalysisState } from "@/lib/platformTypes";

type WorkspaceSyncBannerProps = Pick<
  PlatformAnalysisState,
  "message" | "status" | "updated_at"
>;

const statusCopy: Record<
  WorkspaceSyncBannerProps["status"],
  { title: string; icon: typeof Loader2; tone: string }
> = {
  idle: {
    title: "Platform sync ready",
    icon: Sparkles,
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  },
  syncing: {
    title: "Platform sync in progress",
    icon: Loader2,
    tone: "border-blue-200 bg-blue-50 text-blue-800",
  },
  synced: {
    title: "Platform analysis synced",
    icon: CheckCircle2,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  fallback: {
    title: "Using local synthesis",
    icon: AlertTriangle,
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  error: {
    title: "Platform sync needs attention",
    icon: AlertTriangle,
    tone: "border-red-200 bg-red-50 text-red-800",
  },
};

export function WorkspaceSyncBanner({
  status,
  message,
  updated_at,
}: WorkspaceSyncBannerProps) {
  const config = statusCopy[status];
  const Icon = config.icon;
  const timestamp = updated_at
    ? new Date(updated_at).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        config.tone,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            status === "syncing" && "animate-spin",
          )}
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold">{config.title}</div>
          {message ? (
            <div className="mt-1 text-xs leading-5 opacity-90">{message}</div>
          ) : null}
          {timestamp ? (
            <div className="mt-1 text-[11px] uppercase tracking-[0.16em] opacity-75">
              Last synced {timestamp}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
