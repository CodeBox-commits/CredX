import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Mail,
  Lock,
  Building2,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organization, setOrganization] = useState("");

  const canSignIn = useMemo(
    () => email.trim().length > 0 && password.trim().length > 0,
    [email, password],
  );

  const handleSignIn = () => {
    if (!canSignIn) return;
    navigate("/dashboard");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef3ff] px-4 py-10">
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-blue-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-0 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl" />

      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <section className="rounded-[32px] border border-white/60 bg-white/75 p-8 shadow-[0_20px_80px_rgba(35,69,163,0.12)] backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900">
            <ShieldCheck className="h-4 w-4" />
            Single secure workspace login
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Sign in to CredX
            </h1>
            <p className="max-w-xl text-base text-slate-600">
              One login now unlocks the full credit intelligence workspace,
              including document analysis, dashboards, and CAM preparation.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">
                One account
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Borrower-role split removed for a simpler sign-in flow.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">
                Fast access
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Jump straight into dashboards and uploaded document reviews.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">
                Secure workspace
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Designed for internal credit teams and analysts.
              </div>
            </div>
          </div>
        </section>

        <Card className="border-slate-200 bg-white shadow-[0_20px_80px_rgba(35,69,163,0.14)]">
          <CardHeader className="px-8 pb-4 pt-8">
            <CardTitle className="text-2xl font-bold text-blue-900">
              Welcome back
            </CardTitle>
            <CardDescription className="text-blue-900">
              Use your workspace credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-8 pb-8">
            <div className="space-y-1.5">
              <Label
                htmlFor="login-email"
                className="text-sm font-semibold text-blue-900"
              >
                Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="credit.team@bank.com"
                  className="h-11 border-slate-200 pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="login-password"
                className="text-sm font-semibold text-blue-900"
              >
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  className="h-11 border-slate-200 pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="login-organization"
                className="text-sm font-semibold text-blue-900"
              >
                Organization
              </Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="login-organization"
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  placeholder="CredX Internal Credit Team"
                  className="h-11 border-slate-200 pl-10"
                />
              </div>
            </div>

            <Button
              className="h-11 w-full bg-blue-900 text-sm font-semibold text-white hover:bg-blue-800"
              onClick={handleSignIn}
              disabled={!canSignIn}
            >
              Continue to workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <div className="flex items-center justify-between text-sm">
              <Link to="/" className="font-medium text-blue-900 hover:underline">
                Back to home
              </Link>
              <span className="text-slate-500">
                Single login for all users
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
