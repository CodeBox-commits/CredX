import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Brain,
  Building2,
  CheckCircle2,
  Database,
  Factory,
  FileCheck,
  FileText,
  Files,
  Gavel,
  Globe2,
  Landmark,
  LineChart,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { RiskGauge } from "@/components/RiskGauge";
import { MetricCard } from "@/components/MetricCard";
import { AIInsightCard } from "@/components/AIInsightCard";

const intelligenceBuckets: Array<{
  title: string;
  icon: LucideIcon;
  items: string[];
}> = [
  {
    title: "Structured Data",
    icon: Database,
    items: ["GST filings", "ITRs", "Bank statements"],
  },
  {
    title: "Unstructured Data",
    icon: FileText,
    items: [
      "Annual reports",
      "Financial statements",
      "Board meeting minutes",
      "Rating agency reports",
      "Shareholding pattern",
    ],
  },
  {
    title: "External Intelligence",
    icon: Globe2,
    items: [
      "Sector trend news",
      "MCA filings",
      "Legal disputes on e-Courts",
    ],
  },
  {
    title: "Primary Insights",
    icon: Factory,
    items: [
      "Factory site-visit observations",
      "Management interviews",
      "Due-diligence notes",
    ],
  },
];

const deliverables: Array<{
  step: string;
  title: string;
  icon: LucideIcon;
  description: string;
  bullets: string[];
}> = [
  {
    step: "Pillar 1",
    title: "The Data Ingestor",
    icon: Workflow,
    description:
      "Support high-latency, multi-format ingestion across messy financial and legal documents.",
    bullets: [
      "Extract commitments and risk signals from annual reports, legal notices, and sanction letters.",
      "Cross-leverage GST returns and bank statements to spot circular trading or revenue inflation.",
    ],
  },
  {
    step: "Pillar 2",
    title: "The Research Agent",
    icon: Search,
    description:
      "Act as a digital credit manager that expands the view beyond submitted files.",
    bullets: [
      "Crawl promoter news, sector headwinds, RBI-linked developments, and litigation history.",
      "Let credit officers capture qualitative notes and feed them back into the risk score.",
    ],
  },
  {
    step: "Pillar 3",
    title: "The Recommendation Engine",
    icon: Brain,
    description:
      "Turn evidence into an explainable lending recommendation and an automated CAM.",
    bullets: [
      "Generate a structured Credit Appraisal Memo covering the Five Cs of Credit.",
      "Recommend loan amount, pricing, and rejections using a transparent scoring model.",
    ],
  },
];

const evaluationCriteria: Array<{
  title: string;
  icon: LucideIcon;
  description: string;
}> = [
  {
    title: "Extraction Accuracy",
    icon: FileCheck,
    description:
      "How well the tool extracts signals from messy, scanned Indian-context PDFs.",
  },
  {
    title: "Research Depth",
    icon: Search,
    description:
      "Whether the engine finds local news, filings, and regulatory intelligence beyond uploaded files.",
  },
  {
    title: "Explainability",
    icon: LineChart,
    description:
      "Whether the recommendation can clearly justify why a limit, rejection, or premium was proposed.",
  },
  {
    title: "Indian Context Sensitivity",
    icon: Landmark,
    description:
      "Whether the system understands India-specific signals such as GSTR-2A vs 3B and CIBIL Commercial data.",
  },
];

const quickActions: Array<{
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
}> = [
  {
    title: "Document Analyzer",
    description:
      "Prototype the data-ingestor layer by uploading financial documents and extracting signals.",
    to: "/document-analyzer",
    icon: Files,
  },
  {
    title: "AI Copilot",
    description:
      "Explore the digital credit-manager idea with question answering and synthesis workflows.",
    to: "/copilot",
    icon: Bot,
  },
  {
    title: "Credit Risk Engine",
    description:
      "Review how scoring, simulation, and recommendation logic can be surfaced to end users.",
    to: "/credit-risk",
    icon: ShieldCheck,
  },
  {
    title: "CAM Generator",
    description:
      "See how the final recommendation can be packaged into a structured credit memo output.",
    to: "/cam-generator",
    icon: FileText,
  },
];

const challengeSignals = [
  "Manual bottlenecks slow down corporate underwriting.",
  "Early warning signals hide inside long unstructured filings.",
  "Bias grows when credit teams stitch together evidence manually.",
];

const heroTags = [
  "Indian corporate lending",
  "CAM automation",
  "Explainable ML",
  "Web-scale research",
];

const outcomeBullets = [
  "Automate end-to-end CAM preparation across structured, unstructured, and external data sources.",
  "Produce a recommendation on whether to lend, the sanction limit, and the appropriate risk premium.",
  "Keep the decision traceable enough to justify rejections or approvals with evidence.",
];

const impactBullets = [
  "Target a workflow that compresses week-long underwriting into a guided AI-assisted flow.",
  "Design for scanned PDFs, MCA filings, promoter signals, and due-diligence observations in the same system.",
  "Treat the final recommendation as explainable decision support, not a black-box answer.",
];

const SectionHeader = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) => (
  <div className="max-w-3xl space-y-3">
    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
      {eyebrow}
    </div>
    <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
      {title}
    </h2>
    <p className="text-base leading-7 text-slate-600">{description}</p>
  </div>
);

const BucketCard = ({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: LucideIcon;
  items: string[];
}) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-lg font-semibold text-slate-900">{title}</div>
    </div>
    <div className="mt-5 space-y-3">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-3 text-sm text-slate-600">
          <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  </div>
);

const DeliverableCard = ({
  step,
  title,
  icon: Icon,
  description,
  bullets,
}: {
  step: string;
  title: string;
  icon: LucideIcon;
  description: string;
  bullets: string[];
}) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
          {step}
        </div>
        <div className="mt-2 text-xl font-semibold text-slate-900">{title}</div>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" />
      </div>
    </div>

    <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>

    <div className="mt-5 space-y-3">
      {bullets.map((bullet) => (
        <div key={bullet} className="flex items-start gap-3 text-sm text-slate-600">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>{bullet}</span>
        </div>
      ))}
    </div>
  </div>
);

const CriterionCard = ({
  title,
  icon: Icon,
  description,
}: {
  title: string;
  icon: LucideIcon;
  description: string;
}) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
      <Icon className="h-5 w-5" />
    </div>
    <div className="mt-4 text-lg font-semibold text-slate-900">{title}</div>
    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
  </div>
);

const QuickActionCard = ({
  title,
  description,
  to,
  icon: Icon,
}: {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
}) => (
  <Link
    to={to}
    className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
  >
    <div className="flex items-center justify-between gap-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-100">
        <Icon className="h-5 w-5" />
      </div>
      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700" />
    </div>
    <div className="mt-5 text-lg font-semibold text-slate-900">{title}</div>
    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
  </Link>
);

export default function Landing() {
  return (
    <div className="space-y-16 pb-16 pt-10">
      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="relative overflow-hidden rounded-[36px] bg-slate-950 p-8 shadow-[0_28px_100px_rgba(15,23,42,0.36)] sm:p-10">
          <div className="pointer-events-none absolute -left-16 top-0 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-blue-100">
                <Sparkles className="h-4 w-4" />
                Hackathon Problem Statement
              </div>

              <div className="space-y-4">
                <div className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-200">
                  Intelli-Credit Challenge
                </div>
                <h1 className="max-w-4xl text-4xl font-bold leading-[1.05] text-white sm:text-6xl">
                  Next-Gen Corporate Credit Appraisal: Bridging the Intelligence Gap
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                  CredX is positioned as an AI-powered credit decisioning engine
                  for Indian corporate lending, designed to turn fragmented
                  financial information into structured, explainable credit
                  assessments and CAM-ready recommendations.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/document-analyzer"
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Explore Prototype
                </Link>
                <Link
                  to="/login"
                  className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Open Workspace
                </Link>
              </div>

              <div className="flex flex-wrap gap-3">
                {heroTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[30px] border border-white/10 bg-white/95 p-4 shadow-2xl">
                <RiskGauge score={742} label="Indicative Score" size="lg" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <MetricCard
                  title="Intelligence Sources"
                  value="4"
                  subtitle="Structured, unstructured, external, primary"
                  icon={Database}
                  glowColor="primary"
                />
                <MetricCard
                  title="Core Pillars"
                  value="3"
                  subtitle="Ingestor, research agent, recommendation engine"
                  icon={Workflow}
                  glowColor="warning"
                />
                <MetricCard
                  title="End Goal"
                  value="CAM"
                  subtitle="Explainable lending recommendation"
                  icon={ShieldCheck}
                  glowColor="success"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 md:px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="Context"
            title="The Data Paradox in Indian corporate lending"
            description="Credit managers are flooded with information, yet it still takes weeks to process a single mid-sized corporate loan application. The challenge is not data scarcity, but stitching together the right evidence fast enough and clearly enough to act on it."
          />

          <div className="mt-8 rounded-3xl bg-slate-950 p-6 text-white">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">
              Problem Statement
            </div>
            <p className="mt-4 text-base leading-7 text-slate-200">
              Build an AI-powered Credit Decisioning Engine that ingests
              multi-source data, performs deep secondary research, integrates
              primary due-diligence notes, and produces a final ML-based
              lending recommendation on whether to lend, what the sanction
              limit should be, and at what risk premium.
            </p>

            <div className="mt-6 space-y-3">
              {outcomeBullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
            Why It Matters
          </div>
          <div className="mt-4 space-y-3">
            {challengeSignals.map((signal, index) => (
              <AIInsightCard
                key={signal}
                title={`Challenge ${index + 1}`}
                insight={signal}
                severity={index === 0 ? "warning" : index === 1 ? "critical" : "info"}
                tags={["Intelli-Credit", "Hackathon"]}
              />
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Manual underwriting today is fragmented
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The current process is slow, prone to human bias, and often
                  misses early warning signals buried inside long filings,
                  scanned documents, or external intelligence that never gets
                  pulled into the same decision flow.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="Data Landscape"
            title="A complete view requires four different intelligence streams"
            description="The challenge is explicitly multi-source. A winning solution cannot stop at document OCR. It needs to combine structured numbers, unstructured narratives, external research, and on-ground due diligence."
          />

          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {intelligenceBuckets.map((bucket) => (
              <BucketCard
                key={bucket.title}
                title={bucket.title}
                icon={bucket.icon}
                items={bucket.items}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="Key Deliverables"
            title="The prototype must cover three major pillars"
            description="The hackathon asks for more than isolated features. The final system should connect ingestion, research, and recommendation into a single explainable lending workflow."
          />

          <div className="mt-8 grid gap-6 xl:grid-cols-3">
            {deliverables.map((item) => (
              <DeliverableCard
                key={item.title}
                step={item.step}
                title={item.title}
                icon={item.icon}
                description={item.description}
                bullets={item.bullets}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 md:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="Evaluation Criteria"
            title="How solutions will be judged"
            description="The judging focus is not just on features. It is on whether the system is accurate on Indian financial documents, deep on research, interpretable in its logic, and sensitive to local underwriting nuances."
          />
          <div className="mt-6 space-y-3">
            {impactBullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3 text-sm text-slate-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {evaluationCriteria.map((criterion) => (
            <CriterionCard
              key={criterion.title}
              title={criterion.title}
              icon={criterion.icon}
              description={criterion.description}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="Prototype Entry Points"
            title="Use the current CredX screens as the foundation"
            description="The live app already maps well to the hackathon narrative. You can move from ingestion to questioning, scoring, and memo generation through the modules below."
          />

          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => (
              <QuickActionCard
                key={action.title}
                title={action.title}
                description={action.description}
                to={action.to}
                icon={action.icon}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="overflow-hidden rounded-[36px] bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.32)]">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-blue-100">
                <Gavel className="h-4 w-4" />
                Submission Framing
              </div>
              <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
                Build for evidence-backed lending decisions, not just extraction demos
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                The strongest CredX story is an end-to-end decisioning engine:
                one system that can parse, research, synthesize, score, and
                justify a CAM recommendation in an Indian corporate credit
                context.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/document-analyzer"
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Start With Ingestion
                </Link>
                <Link
                  to="/cam-generator"
                  className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  View CAM Flow
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">
                Final Note
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-3 text-sm text-slate-200">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  <span>Five Cs of Credit should be reflected in the CAM output.</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-slate-200">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>Transparent pricing and sanction logic matters as much as model performance.</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-slate-200">
                  <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <span>India-specific reconciliation and regulatory nuance should be visible throughout the flow.</span>
                </div>
              </div>
              <div className="mt-6 rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
                More details can be layered in later, but this page now reflects
                the current hackathon brief and gives the platform a much clearer
                story for demos and judging.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
