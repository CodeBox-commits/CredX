import { BookOpen, Cpu, ShieldCheck, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const StepCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
}) => (
  <Card className="h-full border-slate-200 shadow-sm">
    <CardContent className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-semibold text-slate-900">{title}</div>
        </div>
      </div>
      <div className="text-sm text-slate-600">{description}</div>
    </CardContent>
  </Card>
);

const DeveloperCard = ({ name, role }: { name: string; role: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <Users className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900">{name}</div>
        <div className="text-xs text-slate-500">{role}</div>
      </div>
    </div>
  </div>
);

export default function AboutUs() {
  return (
    <div className="space-y-10 pb-16">
      <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">
            How IntelliCredit Works
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600">
            IntelliCredit turns financial documents into structured credit
            insights using AI-powered analysis and credit risk modeling.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <StepCard
              icon={BookOpen}
              title="Upload Financial Documents"
              description="Users upload annual reports, bank statements, GST returns, and auditor notes."
            />
            <StepCard
              icon={Cpu}
              title="AI Financial Analysis"
              description="AI models extract financial indicators, ratios, and trends from the uploaded documents."
            />
            <StepCard
              icon={ShieldCheck}
              title="Credit Risk Insights"
              description="The system evaluates credit risk and generates insights along with CAM reports for lenders and analysts."
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Developers</h2>
          <p className="mt-2 text-base text-slate-600">
            Built by a team of full-stack engineers focused on delivering secure
            and reliable credit analysis.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <DeveloperCard name="CHINNALA ABHINAV" role="Backend Developer" />
            <DeveloperCard
              name="NAMANA SAI VEERA CHIRANJEEVI"
              role="Backend Developer"
            />
            <DeveloperCard
              name="KODURU CHANDRASEKHAR"
              role="Frontend Developer"
            />
            <DeveloperCard name="AMULA BHANU TEJA" role="Frontend Developer" />
          </div>
        </div>
      </div>
    </div>
  );
}
