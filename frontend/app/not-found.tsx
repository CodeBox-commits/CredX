import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl font-semibold">This page isn't on the ledger</h1>
      <p className="text-muted-foreground">The case or page you're looking for doesn't exist or was moved.</p>
      <Button asChild className="mt-2"><Link href="/dashboard">Back to command center</Link></Button>
    </div>
  );
}
