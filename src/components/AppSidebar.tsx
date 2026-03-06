import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileSearch,
  Globe,
  BarChart3,
  FileText,
  Bot,
  Brain,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "AI Dashboard" },
  { to: "/document-analyzer", icon: FileSearch, label: "Document Analyzer" },
  { to: "/research", icon: Globe, label: "Corporate Research" },
  { to: "/credit-risk", icon: BarChart3, label: "Credit Risk" },
  { to: "/cam-generator", icon: FileText, label: "CAM Generator" },
  { to: "/copilot", icon: Bot, label: "AI Copilot" },
];

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-primary" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-foreground tracking-tight">IntelliCredit</h1>
            <p className="text-[10px] text-primary font-mono tracking-widest uppercase">AI Platform</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all group",
                isActive
                  ? "bg-primary/10 text-primary border-glow border"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-transparent"
              )}
            >
              <item.icon className={cn("w-4 h-4 shrink-0", isActive && "text-primary")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status */}
      {!collapsed && (
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <Shield className="w-3 h-3 text-success" />
            <span>SYSTEM OPERATIONAL</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
            <span>AI ENGINE v3.2.1</span>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-2 border-t border-sidebar-border text-muted-foreground hover:text-foreground transition-colors flex justify-center"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
};
