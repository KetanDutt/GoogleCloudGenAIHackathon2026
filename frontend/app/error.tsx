"use client";
import { Button } from "@/components/ui/Primitives";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="panel mx-auto max-w-lg p-8 text-center">
      <h1 className="text-xl">Something didn’t go as planned.</h1>
      <p className="mb-5 mt-3 text-sm text-muted">
        Your saved work is still there. Try opening this page again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
