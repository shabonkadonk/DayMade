import Link from "next/link";
import { Sun } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
export default function NotFound() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="plan-empty">
        <Sun size={35} />
        <h1>A little off the beaten path.</h1>
        <p>This page isn’t here. Your next good day still can be.</p>
        <Link href="/" className="button button-primary">
          Back to DayMade
        </Link>
      </main>
    </>
  );
}
