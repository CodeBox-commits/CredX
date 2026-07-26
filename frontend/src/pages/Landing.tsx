import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Factory,
  FileCheck2,
  FileText,
  Files,
  Globe2,
  Landmark,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { RiskGauge } from "@/components/RiskGauge";
import { MetricCard } from "@/components/MetricCard";

const evidenceStreams: Array<{
  title: string;
  icon: LucideIcon;
  tone: string;
  items: string[];
}> = [
  {
    title: "Structured Inputs",
    icon: Files,
    tone: "from-sky-100 to-white text-sky-900",
    items: ["GST", "ITRs", "Bank statements"],
  },
  {
    title: "Narrative Documents",
    icon: FileText,
    tone: "from-cyan-100 to-white text-cyan-900",
    items: ["Annual reports", "Ratings", "Shareholding"],
  },
  {
    title: "External Signals",
    icon: Globe2,
    tone: "from-emerald-100 to-white text-emerald-900",
    items: ["Sector news", "MCA filings", "Court records"],
  },
  {
    title: "Primary Notes",
    icon: Factory,
    tone: "from-amber-100 to-white text-amber-900",
    items: ["Site visit", "Management interview", "Credit officer notes"],
  },
];

const workflowCards: Array<{
  step: string;
  title: string;
  icon: LucideIcon;
  points: string[];
}> = [
  {
    step: "01",
    title: "Ingest and normalize evidence",
    icon: Workflow,
    points: ["Messy PDFs become usable signals", "Coverage gaps stay visible"],
  },
  {
    step: "02",
    title: "Run research in the same case context",
    icon: Search,
    points: ["Promoter, sector, legal, regulatory", "Primary notes act as overrides"],
  },
  {
    step: "03",
    title: "Explain the recommendation",
    icon: BrainCircuit,
    points: ["Loan limit, pricing, and trace", "Committee-friendly CAM output"],
  },
];

const judgeLens = [
  {
    title: "Extraction",
    detail: "Can it pull useful credit signals from Indian financial documents?",
    icon: FileCheck2,
  },
  {
    title: "Research",
    detail: "Does the system surface promoter, sector, and litigation context quickly?",
    icon: Globe2,
  },
  {
    title: "Explainability",
    detail: "Can a judge follow why the limit or rejection was proposed?",
    icon: Scale,
  },
  {
    title: "Local nuance",
    detail: "Does it reflect India-specific cues like GSTR-2A/3B and compliance overlays?",
    icon: Landmark,
  },
];

const modules = [
  {
    title: "Document Analyzer",
    description: "Upload evidence and see the case assemble itself.",
    to: "/document-analyzer",
    icon: Files,
  },
  {
    title: "Research Agent",
    description: "Review promoter, sector, and litigation findings in context.",
    to: "/research",
    icon: Search,
  },
  {
    title: "Decision Engine",
    description: "Work through risk, scenarios, and qualitative adjustments.",
    to: "/credit-risk",
    icon: ShieldCheck,
  },
  {
    title: "CAM Builder",
    description: "Export a credit memo that reads like a real underwriting file.",
    to: "/cam-generator",
    icon: FileText,
  },
];

function SectionLead({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl space-y-3">
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">{title}</h2>
      <p className="text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
    </div>
  );
}

function WorkflowCard({
  step,
  title,
  icon: Icon,
  points,
}: {
  step: string;
  title: string;
  icon: LucideIcon;
  points: string[];
}) {
  return (
    <div className="surface-panel p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-eyebrow text-[10px]">Step {step}</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">{title}</h3>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {points.map((point) => (
          <div
            key={point}
            className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600"
          >
            {point}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModuleCard({
  title,
  description,
  to,
  icon: Icon,
}: {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      to={to}
      className="surface-panel group block p-5 transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_56px_rgba(15,23,42,0.10)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f3d70,#1580c2)] text-white">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </Link>
  );
}

export default function Landing() {
  return (
    <div className="space-y-10 pb-14 pt-4">
      <section className="page-shell">
        <div className="surface-dark relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 soft-grid opacity-30" />
          <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-12 bottom-0 h-64 w-64 rounded-full bg-blue-500/14 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-sky-100">
                <Sparkles className="h-4 w-4" />
                Next-gen corporate credit appraisal
              </div>

              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] text-white sm:text-6xl">
                  A cleaner way to turn corporate lending evidence into a credit decision.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-300">
                  CredX is now framed as a decision cockpit, not a pasted brief.
                  Teams can move from ingestion to research to recommendation in one
                  interface that feels built for underwriting.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/dashboard"
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Open Command Center
                </Link>
                <Link
                  to="/document-analyzer"
                  className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Start With Ingestion
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="pill-chip border-white/10 bg-white/5 text-slate-200">GST + bank synthesis</span>
                <span className="pill-chip border-white/10 bg-white/5 text-slate-200">Secondary research</span>
                <span className="pill-chip border-white/10 bg-white/5 text-slate-200">Primary diligence overrides</span>
                <span className="pill-chip border-white/10 bg-white/5 text-slate-200">Explainable CAM</span>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[30px] border border-white/10 bg-white/[0.08] p-4 backdrop-blur-md">
                <RiskGauge score={742} label="Sanction View" size="lg" />
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <MetricCard
                  title="Decision Time"
                  value="Minutes"
                  subtitle="Not weeks of manual stitching"
                  icon={Workflow}
                  glowColor="primary"
                />
                <MetricCard
                  title="Core Flow"
                  value="3"
                  subtitle="Ingest, research, decide"
                  icon={BrainCircuit}
                  glowColor="warning"
                />
                <MetricCard
                  title="Output"
                  value="CAM"
                  subtitle="Committee-ready memo"
                  icon={ShieldCheck}
                  glowColor="success"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell">
        <div className="surface-panel-strong p-6 md:p-8">
          <SectionLead
            eyebrow="How It Feels"
            title="The product story is now shorter, clearer, and easier to demo."
            description="Instead of explaining the hackathon brief section by section, the interface now shows a practical flow: what evidence goes in, how the engine works, and what decision comes out."
          />

          <div className="mt-8 grid gap-4 xl:grid-cols-3">
            {workflowCards.map((card) => (
              <WorkflowCard
                key={card.step}
                step={card.step}
                title={card.title}
                icon={card.icon}
                points={card.points}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell">
        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="surface-panel-strong p-6 md:p-8">
            <SectionLead
              eyebrow="Evidence Map"
              title="Four streams feed the same case file."
              description="The layout now treats data sources like inputs to one operating system instead of four separate paragraphs."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {evidenceStreams.map((stream) => {
                const Icon = stream.icon;
                return (
                  <div
                    key={stream.title}
                    className={`rounded-[26px] border border-slate-200 bg-gradient-to-br p-5 ${stream.tone}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-950">{stream.title}</h3>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {stream.items.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-slate-200 bg-white/[0.85] px-3 py-1.5 text-xs text-slate-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="surface-panel-strong p-6 md:p-8">
            <SectionLead
              eyebrow="Decision Board"
              title="A borrower view that feels operational."
              description="This side of the product is about confidence: signal density, evidence coverage, and recommendation logic all stay visible at once."
            />

            <div className="mt-8 grid gap-4">
              <div className="rounded-[26px] border border-slate-200 bg-slate-950 p-5 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Recommendation</p>
                    <p className="mt-2 text-2xl font-semibold">Conditional Approval</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-sky-200">
                    Rs 140 Cr at 11.8%
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Top cue</p>
                    <p className="mt-2 text-sm text-white">GST-bank variance</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Primary note</p>
                    <p className="mt-2 text-sm text-white">Capacity at 40%</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Output</p>
                    <p className="mt-2 text-sm text-white">Explainable CAM</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <p className="section-eyebrow text-[10px]">Why users like this</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <p>Shorter sections and stronger hierarchy.</p>
                    <p>More metrics, fewer wall-of-text explanations.</p>
                    <p>A demo path that feels product-first, not document-first.</p>
                  </div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <p className="section-eyebrow text-[10px]">Visible outputs</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="pill-chip">Decision trace</span>
                    <span className="pill-chip">Monitoring triggers</span>
                    <span className="pill-chip">Source coverage</span>
                    <span className="pill-chip">Research findings</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell">
        <div className="surface-panel-strong p-6 md:p-8">
          <SectionLead
            eyebrow="Judge Lens"
            title="The demo can now guide judges through four simple lenses."
            description="This section keeps the evaluation criteria visible without sounding like copied submission copy."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {judgeLens.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="surface-panel p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#123a66,#1890c5)] text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="page-shell">
        <div className="surface-panel-strong p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <SectionLead
              eyebrow="Explore The Product"
              title="Every major screen now has a clearer role."
              description="Pick the module you want to show in a demo and the interface will still feel like one connected system."
            />
            <Link
              to="/copilot"
              className="inline-flex items-center gap-2 self-start rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Bot className="h-4 w-4" />
              Open Copilot
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((module) => (
              <ModuleCard
                key={module.title}
                title={module.title}
                description={module.description}
                to={module.to}
                icon={module.icon}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
