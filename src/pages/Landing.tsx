import { Link } from "react-router-dom";
import { CreditCard, TrendingUp, FileText, ShieldCheck } from "lucide-react";
import DocumentAnalyzer from "./DocumentAnalyzer";

const CreditMeter = ({ score }: { score: number }) => {
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (score / 900) * circumference;

  return (
    <div className="flex w-full max-w-[360px] flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">
        Your IntelliCredit Score
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
            <div className="text-4xl font-bold text-slate-900">{score}</div>
            <div className="text-xs font-semibold text-slate-500">
              Excellent
            </div>
          </div>
        </div>
      </div>
      <div className="text-xs text-slate-500">
        Based on available financial indicators
      </div>
    </div>
  );
};

export default function Landing() {
  return (
    <div className="space-y-16 pb-16">
      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="rounded-3xl bg-gradient-to-br from-[#eef3ff] to-white p-8 shadow-sm">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
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
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">
                    500+ Reports Analyzed
                  </div>
                  <div className="text-xs text-slate-500">
                    Trusted by credit analysts
                  </div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">
                    98% Extraction Accuracy
                  </div>
                  <div className="text-xs text-slate-500">
                    Validated by automated QA
                  </div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">
                    AI Powered Insights
                  </div>
                  <div className="text-xs text-slate-500">
                    Contextual credit risk summaries
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
              <CreditMeter score={736} />
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
