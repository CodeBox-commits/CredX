import { NavLink } from "react-router-dom";
import { Bot, Command, LayoutDashboard, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMAND_PALETTE_EVENT } from "@/config/events";
import { workspaceRoutes } from "@/config/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

export const TopNavbar = () => {
  return (
    <header className="sticky top-0 z-50 px-3 pt-3 md:px-5">
      <div className="surface-panel mx-auto flex w-full max-w-[1480px] flex-col gap-3 px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(140deg,#0f3d70,#0f68b7)] shadow-[0_12px_26px_rgba(15,61,112,0.24)]">
              <img
                src="/favicon.jpg"
                alt="CredX logo"
                className="h-5 w-5 rounded-sm object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900">CredX</span>
                <span className="hidden rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700 sm:inline-flex">
                  Intelli-Credit
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Corporate credit intelligence workspace
              </p>
            </div>
          </NavLink>

          <div className="flex flex-wrap items-center gap-2">
            <div className="pill-chip hidden sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5 text-sky-700" />
              Explainable lending workflow
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT))}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <Command className="h-4 w-4" />
              Search
              <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 sm:inline dark:bg-slate-800 dark:text-slate-400">
                Ctrl K
              </span>
            </button>
            <ThemeToggle />
            <NavLink
              to="/copilot"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Bot className="h-4 w-4" />
              Copilot
            </NavLink>
            <NavLink
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <LayoutDashboard className="h-4 w-4" />
              Workspace
            </NavLink>
          </div>
        </div>

        <nav className="flex items-center gap-2 overflow-x-auto pb-1">
          {workspaceRoutes.slice(0, 6).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-[linear-gradient(135deg,#123a66,#1166b6)] text-white shadow-[0_12px_24px_rgba(17,102,182,0.22)]"
                    : "bg-white/70 text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
};
