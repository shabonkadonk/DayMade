"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Heart,
  Compass,
  Coffee,
  WandSparkles,
  Check,
  ShieldCheck,
  Sun,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PreferenceControls } from "./preferences";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/browser";
import type { Itinerary, Preferences } from "@/types/itinerary";

const suggestions = [
  {
    Icon: Heart,
    label: "A date to remember",
    prompt:
      "Plan a romantic evening in San Francisco for two people under $100 total, with vegetarian-friendly dinner and a beautiful sunset.",
  },
  {
    Icon: Compass,
    label: "A little adventure",
    prompt:
      "I have four free hours in San Francisco and $75 total. Plan an adventurous afternoon with something outdoors and a great bite to eat.",
  },
  {
    Icon: Coffee,
    label: "Take it slow",
    prompt:
      "Plan a relaxing Sunday in Madison with coffee, an independent bookstore, and a scenic walk. Keep it under $50 total for one person.",
  },
  {
    Icon: WandSparkles,
    label: "Surprise me",
    prompt:
      "Surprise me with a creative Saturday afternoon in San Francisco. Two people, $150 total, something delicious and somewhere we wouldn't usually go.",
  },
];
const inspirations = [
  {
    image: "/images/coast.jpg",
    category: "A LITTLE ADVENTURE",
    title: "Take the scenic route.",
    detail: "Fresh air. New perspectives. No rush.",
    prompt:
      "Plan a scenic day outdoors in San Francisco for two, with a coastal walk, picnic, and sunset. Budget $100 total.",
  },
  {
    image: "/images/cafe.jpg",
    category: "THE ART OF SLOWING DOWN",
    title: "Nowhere to be. Except here.",
    detail: "Good coffee and a day that’s all yours.",
    prompt: suggestions[2].prompt,
  },
  {
    image: "/images/dinner.jpg",
    category: "BETTER TOGETHER",
    title: "Make a little room for us.",
    detail: "A table for two. A story for later.",
    prompt: suggestions[0].prompt,
  },
];
export function Home() {
  const [prompt, setPrompt] = useState("");
  const [preferences, setPreferences] = useState<Preferences>({ location: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    message: string;
    configuration: boolean;
  } | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const reduced = useReducedMotion();
  function applyPrompt(value: string) {
    setPrompt(value);
    setError(null);
    textarea.current?.focus();
    document.getElementById("planner")?.scrollIntoView({
      behavior: reduced ? "instant" : "smooth",
      block: "center",
    });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 170000);
    try {
      const result = await apiRequest<{ itinerary: Itinerary }>(
        "/api/plan",
        { prompt, preferences },
        controller.signal,
      );
      router.push(`/plan/${result.itinerary.id}`);
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      setError({
        message:
          e instanceof Error && e.name === "AbortError"
            ? "Planning took longer than expected. Please try a shorter outing."
            : e instanceof Error
              ? e.message
              : "Something went wrong. Please try again.",
        configuration: code === "AI_CONFIGURATION_REQUIRED",
      });
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }
  return (
    <>
      <Navbar />
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="hero-note">
              <span className="small-sun">
                <Sun size={14} />
              </span>{" "}
              Less planning. More living.
            </div>
            <h1 id="hero-title">
              Your next great day
              <br />
              starts <em>here.</em>
              <span className="headline-star" aria-hidden="true">
                ✳
              </span>
            </h1>
            <p className="hero-description">
              A little idea. A whole lot of possibility.
              <br className="mobile-break" /> Tell us what you’re in the mood
              for.
              <br className="desktop-break" /> We’ll find the places, connect
              the dots, and help make it happen.
            </p>
          </motion.div>
          <motion.div
            className="planner-wrap"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <form id="planner" className="prompt-composer" onSubmit={submit}>
              <div className="composer-label">
                <Sparkles size={17} />
                <span>What would make your day?</span>
              </div>
              <label className="sr-only" htmlFor="day-prompt">
                Describe your perfect day
              </label>
              <textarea
                id="day-prompt"
                ref={textarea}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                minLength={10}
                maxLength={3000}
                required
                disabled={busy}
                placeholder="A Saturday in San Francisco. Great food, a little adventure, and somewhere to watch the sun go down…"
              />
              <div className="composer-toolbar">
                <PreferenceControls
                  value={preferences}
                  onChange={setPreferences}
                />
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <>
                      <LoaderCircle className="spin" size={17} /> Planning your
                      day
                    </>
                  ) : (
                    <>
                      Make my day <ArrowRight size={17} />
                    </>
                  )}
                </Button>
              </div>
            </form>
            {busy && (
              <div className="planning-status" role="status">
                <span className="status-pulse" />
                <div>
                  <strong>Claude is working on your day.</strong>
                  <p>
                    Researching places and building a plan that fits. This can
                    take a minute.
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="error-state" role="alert">
                <AlertCircle size={20} />
                <div>
                  <strong>
                    {error.configuration
                      ? "One connection away from a great day."
                      : "Let’s give that another try."}
                  </strong>
                  <p>{error.message}</p>
                  {error.configuration && (
                    <code>Copy .env.example to .env.local to get started.</code>
                  )}
                </div>
                <button
                  aria-label="Dismiss error"
                  onClick={() => setError(null)}
                  type="button"
                >
                  ×
                </button>
              </div>
            )}
            <div className="suggestion-row">
              <span>A little inspiration?</span>
              {suggestions.map(({ Icon, label, prompt: value }) => (
                <button
                  key={label}
                  type="button"
                  disabled={busy}
                  onClick={() => applyPrompt(value)}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
            <p className="permission-note">
              <ShieldCheck size={14} /> Your day, your call. Nothing gets booked
              without your say-so.
            </p>
          </motion.div>
        </section>
        <section
          className="how-strip"
          id="how-it-works"
          aria-label="How DayMade works"
        >
          <div>
            <span className="step-number">01</span>
            <div>
              <h2>Dream it up</h2>
              <p>A mood, a moment, a “what if.”</p>
            </div>
          </div>
          <span className="step-connector" aria-hidden="true" />
          <div>
            <span className="step-number">02</span>
            <div>
              <h2>We connect the dots</h2>
              <p>Thoughtful places. A plan that flows.</p>
            </div>
          </div>
          <span className="step-connector" aria-hidden="true" />
          <div>
            <span className="step-number">03</span>
            <div>
              <h2>Go make a memory</h2>
              <p>Review, refine, and arrange with Fo.</p>
            </div>
          </div>
        </section>
        <section
          className="explore-section"
          id="explore"
          aria-labelledby="explore-title"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">THERE’S A GOOD DAY OUT THERE</p>
              <h2 id="explore-title">What kind of day is calling?</h2>
            </div>
            <span>
              A few ways to spend it. <Sparkles size={16} />
            </span>
          </div>
          <div className="inspiration-grid">
            {inspirations.map((card) => (
              <button
                className="inspiration-card"
                key={card.title}
                onClick={() => applyPrompt(card.prompt)}
                disabled={busy}
              >
                <div className="inspiration-image">
                  <Image
                    src={card.image}
                    alt=""
                    fill
                    sizes="(max-width: 700px) 100vw, 33vw"
                  />
                  <span className="image-category">{card.category}</span>
                  <span className="image-arrow">
                    <ArrowUpRight size={19} />
                  </span>
                </div>
                <div className="inspiration-copy">
                  <h3>{card.title}</h3>
                  <p>{card.detail}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
        <div className="closing-note">
          <span>
            <Check size={14} /> A plan that fits your budget
          </span>
          <span>
            <Check size={14} /> Made for your kind of fun
          </span>
          <span>
            <Check size={14} /> You approve every arrangement
          </span>
        </div>
      </main>
      <Footer />
    </>
  );
}
