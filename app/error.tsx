"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="plan-empty">
      <h1>A small detour.</h1>
      <p>
        Something went wrong while opening this page. Try again in a moment.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
