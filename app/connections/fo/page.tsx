import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { FoConnection } from "@/components/booking/fo-connection";
export default function FoConnectionPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="connection-page">
        <span className="eyebrow">A LITTLE HELP MAKING IT HAPPEN</span>
        <h1>Your day, with Fo.</h1>
        <p>
          Let your assistant handle the phone calls. You choose the venue,
          review the details, and give the go-ahead.
        </p>
        <FoConnection />
        <Link className="text-link" href="/#planner">
          Back to planning →
        </Link>
      </main>
      <Footer />
    </>
  );
}
