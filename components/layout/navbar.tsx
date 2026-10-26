import Link from "next/link";
import { ArrowUpRight, Sun, Sparkles } from "lucide-react";
export function Navbar() {
  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Main navigation">
        <Link href="/" className="wordmark" aria-label="DayMade home">
          <Sun className="brand-sun" strokeWidth={2.4} />
          <span>
            daymade<span className="logo-period">.</span>
          </span>
        </Link>
        <div className="nav-links">
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#explore">A little inspiration</Link>
          <Link href="/mystery-drop"><Sparkles size={14} /> Mystery Drop</Link>
          <Link href="/connections/fo">Connect Fo</Link>
        </div>
        <Link className="nav-cta" href="/#planner">
          Make a day of it <ArrowUpRight size={16} />
        </Link>
      </nav>
    </header>
  );
}
