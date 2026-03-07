import { NavLink } from "react-router-dom";
import { Building2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/document-analyzer", label: "Document Analyzer" },
  { to: "/research", label: "Corporate Research" },
  { to: "/credit-risk", label: "Credit Risk" },
  { to: "/cam-generator", label: "CAM Generator" },
];

export const TopNavbar = () => {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="border-b border-slate-200">
        <div className="mx-auto flex h-20 w-full max-w-[1400px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center">
            <NavLink to="/dashboard" className="flex items-center gap-2 pr-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50">
                <Building2 className="h-5 w-5 text-blue-900" />
              </div>
              <span className="text-lg font-bold text-blue-900">IntelliCredit</span>
            </NavLink>
            <div className="mx-5 hidden h-10 w-px bg-slate-200 md:block" />
            <NavLink
              to="/copilot"
              className="hidden rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100 md:inline-flex"
            >
              AI Copilot
            </NavLink>
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            <button className="rounded-full bg-blue-900 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Corporate Borrower
            </button>
            <button className="rounded-full border border-blue-900 px-6 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50">
              Credit Manager
            </button>
            <button className="text-sm font-semibold text-blue-900 hover:underline">ENGLISH</button>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-4 md:px-6">
          <nav className="flex items-center gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap px-4 py-4 text-[15px] font-medium text-slate-800 transition-colors hover:text-blue-900",
                    isActive && "border-b-2 border-blue-900 text-blue-900",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Search className="hidden h-5 w-5 text-blue-900 md:block" />
        </div>
      </div>
    </header>
  );
};
