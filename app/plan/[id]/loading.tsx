import { Sun } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
export default function LoadingPlan() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="plan-loading" role="status">
        <Sun size={35} />
        <h1>A good day is on its way.</h1>
        <p>Opening your itinerary…</p>
      </main>
    </>
  );
}
