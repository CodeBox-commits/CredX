import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-aurora opacity-70" />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface text-primary shadow-sm"><SearchX className="h-6 w-6" /></span>
      <p className="label relative">404</p>
      <h1 className="relative text-3xl font-bold">This page isn&apos;t on the ledger</h1>
      <p className="relative max-w-md text-muted-foreground">The case or page you&apos;re looking for doesn&apos;t exist or was moved.</p>
      <Button asChild className="relative mt-2"><Link href="/dashboard"><ArrowLeft /> Back to home</Link></Button>
    </div>
  );
}
