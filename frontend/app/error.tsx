"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/12 text-destructive"><AlertTriangle className="h-6 w-6" /></span>
      <p className="label">Unexpected error</p>
      <h1 className="text-2xl font-bold">Something went wrong rendering this view</h1>
      <p className="max-w-lg text-sm text-muted-foreground">{error.message}{error.digest && <span className="mt-1 block font-mono text-xs">ref {error.digest}</span>}</p>
      <div className="flex gap-2">
        <Button onClick={reset}><RotateCcw /> Try again</Button>
        <Button variant="outline" asChild><Link href="/dashboard">Go home</Link></Button>
      </div>
    </div>
  );
}
