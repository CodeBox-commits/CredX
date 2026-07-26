import { Link } from "react-router-dom";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DocumentAnalyzer from "./DocumentAnalyzer";

const AnimatedCreditMeter = ({ score }: { score: number }) => {
  const circumference = useMemo(() => 2 * Math.PI * 60, []);
  const targetOffset = useMemo(
    () => circumference - (score / 900) * circumference,
    [circumference, score],
  );

  const [offset, setOffset] = useState(circumference);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let frame: number;
    const duration = 900;
    const start = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setOffset(circumference - progress * (circumference - targetOffset));
      setDisplayScore(Math.round(progress * score));

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [circumference, score, targetOffset]);

  return (
    <div className="group relative flex w-full max-w-[360px] flex-col items-center gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="flex w-full items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            CredX Score
          </div>
          <div className="text-xs text-slate-500">
            AI‑driven credit strength estimate
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition group-hover:animate-glow">
          <span className="text-base font-semibold">₹</span>
        </div>
      </div>

      <div className="relative">
        <svg width={160} height={160} viewBox="0 0 160 160">
          <circle
            cx="80"
            cy="80"
            r="60"
            stroke="#E5E7EB"
            strokeWidth="16"
            fill="none"
          />
          <circle
            cx="80"
            cy="80"
            r="60"
            stroke="url(#gradient)"
            strokeWidth="16"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 80 80)"
            style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="33%" stopColor="#F59E0B" />
              <stop offset="66%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl font-bold text-slate-900 numeric">
              {displayScore}
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Excellent
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          Fast score feedback
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
          Updated with each analysis
        </div>
      </div>
    </div>
  );
};

export default function Landing() {
  return (
    <div className="space-y-16 pb-16 pt-10">
      <section className="relative mx-auto w-full max-w-[1400px] px-4 md:px-6 overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -left-28 h-80 w-80 rounded-full bg-gradient-to-br from-blue-300/40 via-white/0 to-transparent blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-80 w-80 rounded-full bg-gradient-to-br from-indigo-200/40 via-white/0 to-transparent blur-2xl" />
        <div className="rounded-3xl bg-gradient-to-br from-[#eef3ff] to-white p-8 shadow-sm">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl animate-text leading-[1.15]">
                AI Powered Credit Intelligence
              </h1>
              <p className="max-w-xl text-base text-slate-600">
                Analyze financial documents, evaluate corporate credit risk, and
                generate CAM reports instantly using AI.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/document-analyzer"
                  className="rounded-full bg-blue-900 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
                >
                  Start Credit Analysis
                </Link>
                <Link
                  to="/copilot"
                  className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Explore AI Copilot
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-4">
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm transition hover:-translate-y-1 hover:shadow-lg animate-fade-in-up">
                  <div className="text-sm font-semibold text-slate-900">
                    98% Extraction Accuracy
                  </div>
                  <div className="text-xs text-slate-500">
                    Validated by automated QA
                  </div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm transition hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-100">
                  <div className="text-sm font-semibold text-slate-900">
                    AI Powered Insights
                  </div>
                  <div className="text-xs text-slate-500">
                    Contextual credit risk summaries
                  </div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm transition hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-200">
                  <div className="text-sm font-semibold text-slate-900">
                    Rapid CAM Report Delivery
                  </div>
                  <div className="text-xs text-slate-500">
                    Get actionable reports in minutes
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Upload any document
                    </div>
                    <div className="text-xs text-slate-500">
                      Annual reports, bank statements, GST returns, auditor
                      notes
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Secure analytics
                    </div>
                    <div className="text-xs text-slate-500">
                      Your data never leaves your device unless you choose to
                      store it.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <AnimatedCreditMeter score={736} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 flex flex-col gap-2 text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              Why CredX?
            </h2>
            <p className="text-sm text-slate-500 max-w-2xl mx-auto">
              Built to help credit teams speed up decisions with transparent,
              audit-ready analysis.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <div className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg animate-fade-in-up">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-900">
                Fast Insights
              </div>
              <div className="text-xs text-slate-500">
                Get analysis in minutes, not days.
              </div>
            </div>
            <div className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <Lock className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-900">
                Privacy by Default
              </div>
              <div className="text-xs text-slate-500">
                Your data stays private unless you choose to share it.
              </div>
            </div>
            <div className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-900">
                High Accuracy
              </div>
              <div className="text-xs text-slate-500">
                Extract key ratios & metrics with industry-grade reliability.
              </div>
            </div>
            <div className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <FileText className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-900">
                Audit‑Ready Reports
              </div>
              <div className="text-xs text-slate-500">
                Export structured CAM analysis for stakeholders and regulators.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Financial Document Analyzer
              </h2>
              <p className="text-sm text-slate-500">
                Upload annual reports and bank statements for AI-driven
                extraction of credit risk indicators.
              </p>
            </div>
            <button
              type="button"
              className="rounded-full bg-blue-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
              onClick={() => {
                document
                  .getElementById("document-analyzer")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Start Extraction
            </button>
          </div>

          <div id="document-analyzer" className="mt-10">
            <DocumentAnalyzer />
          </div>
        </div>
      </section>
    </div>
  );
}

