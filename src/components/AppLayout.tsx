import { NavLink } from "react-router-dom";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const topicItems = [
  "Products & Services",
  "Knowledge Center",
  "Consumer Grievance",
  "Support",
  "About",
];

const appNavItems = [
  { to: "/", label: "Dashboard" },
  { to: "/document-analyzer", label: "Document Analyzer" },
  { to: "/research", label: "Corporate Research" },
  { to: "/credit-risk", label: "Credit Risk" },
  { to: "/cam-generator", label: "CAM Generator" },
  { to: "/copilot", label: "AI Copilot" },
];

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="bg-primary text-primary-foreground">
          <div className="mx-auto flex h-9 w-full max-w-[1400px] items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide">
              <Building2 className="h-3.5 w-3.5" />
              <span>IntelliCredit Corporate Bureau</span>
            </div>
            <button className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground hover:opacity-90">
              Login
            </button>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[1400px] flex-col px-4 md:px-6">
          <nav className="hidden h-11 items-center gap-6 overflow-x-auto border-b border-border text-sm font-medium text-muted-foreground md:flex">
            {topicItems.map((item) => (
              <button key={item} className="whitespace-nowrap hover:text-primary">
                {item}
              </button>
            ))}
          </nav>
          <nav className="flex h-11 items-center gap-2 overflow-x-auto text-sm">
            {appNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:text-primary",
                    isActive && "bg-primary/10 text-primary",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
    </div>
  );
};
