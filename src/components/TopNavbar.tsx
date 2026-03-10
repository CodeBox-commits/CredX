import { NavLink } from "react-router-dom";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/document-analyzer", label: "Document Analyzer" },
  { to: "/research", label: "Corporate Research" },
  { to: "/credit-risk", label: "Credit Risk" },
  { to: "/cam-generator", label: "CAM Generator" },
  { to: "/about", label: "About Us" },
];

export const TopNavbar = () => {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-blue-900/30 bg-gradient-to-b from-[#F6F9FF] to-[#EEF4FF] shadow-sm">
      <div className="border-b border-[#E3ECFF]">
        <div className="mx-auto flex h-20 w-full max-w-[1400px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <NavLink to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50">
                <img
                  src="/favicon.jpg"
                  alt="CredX logo"
                  className="h-5 w-5 float-logo"
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-bold text-blue-900 animate-text">
                  CredX
                </span>
                <span
                  className="mt-[-4px] text-[12px] text-slate-500"
                  style={{ letterSpacing: "0.5px" }}
                >
                  AI Powered Credit Intelligence
                </span>
              </div>
            </NavLink>
          </div>

          <div className="flex items-center gap-2">
            <NavLink
              to="/copilot"
              className="rounded-full border border-transparent bg-[#E9F0FF] px-4 py-2 text-sm font-semibold text-[#2F4DB8] hover:bg-[#D9E5FF]"
            >
              AI Copilot
            </NavLink>
            <NavLink
              to="/login"
              className="rounded-full border border-[#2F4DB8] bg-white px-4 py-2 text-sm font-semibold text-[#2F4DB8] shadow-sm hover:bg-[#EDF3FF]"
            >
              Login
            </NavLink>
            <button className="flex items-center gap-1 rounded-full border border-[#E3ECFF] bg-white px-4 py-2 text-sm font-semibold text-[#2F4DB8] hover:bg-[#EDF3FF]">
              ENGLISH
              <span className="text-xs">▼</span>
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-[#E3ECFF] bg-[#F3F7FF]">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-4 md:px-6">
          <nav className="flex items-center gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap px-4 py-2 text-[15px] font-medium transition duration-200",
                    isActive
                      ? "bg-[#E8F0FF] text-[#1E40AF] rounded-full shadow-sm"
                      : "text-[#2F4DB8] hover:text-[#1E3A8A] hover:bg-[#E8F0FF] rounded-[16px] hover:shadow-sm",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Search className="hidden h-5 w-5 text-[#2F4DB8] md:block" />
        </div>
      </div>
    </header>
  );
};

