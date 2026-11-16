"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The page could not be loaded. If you are running locally, check that the database is up
        (<code className="font-mono text-xs">npm run db:up</code>) and migrated.
      </p>
      {error.digest ? <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
