"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Sparkles,
  LoaderCircle,
  RefreshCw,
  Sun,
  AlertCircle,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActivityCard } from "./activity-card";
import { ItineraryMap } from "./itinerary-map";
import { ItineraryHeader } from "./itinerary-header";
import { BudgetSummary } from "./budget-summary";
import { BookingProgress } from "@/components/booking/booking-progress";
import { ApprovalDialog } from "@/components/booking/approval-dialog";
import { summarize } from "@/lib/itinerary/calculations";
import { apiRequest } from "@/lib/api/browser";
import { money } from "@/lib/utils";
import type { Activity, Itinerary } from "@/types/itinerary";

export function ItineraryView({ id }: { id: string }) {
  const [plan, setPlan] = useState<Itinerary | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [persistence, setPersistence] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const [approval, setApproval] = useState(false),
    [target, setTarget] = useState<Activity | null>(null),
    [instruction, setInstruction] = useState("");
  const [bookingRevision, setBookingRevision] = useState(0);
  const [locked, setLocked] = useState(false);
  const [generalInstruction, setGeneralInstruction] = useState("");
  const reduced = useReducedMotion();
  const select = useCallback(
    (activityId: string) => setSelected(activityId),
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ itinerary: Itinerary; persistence: string }>(
      `/api/itineraries/${id}`,
      undefined,
      controller.signal,
    )
      .then((result) => {
        setPlan(result.itinerary);
        setPersistence(result.persistence);
        setSelected(result.itinerary.activities[0]?.id ?? null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);
  async function refine(
    text: string,
    activityId?: string,
    operation: "refine" | "remove" = "refine",
  ) {
    if (!plan || busy || locked) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 170000);
    try {
      const result = await apiRequest<{ itinerary: Itinerary }>(
        "/api/plan/refine",
        {
          itineraryId: plan.id,
          revision: plan.revision,
          activityId,
          instruction: text,
          operation,
        },
        controller.signal,
      );
      setPlan(result.itinerary);
      if (activityId)
        setSelected(
          result.itinerary.activities.find((a) => a.id === activityId)?.id ??
            result.itinerary.activities[0]?.id ??
            null,
        );
      setTarget(null);
      setInstruction("");
      setGeneralInstruction("");
    } catch (e) {
      setError(
        e instanceof Error && e.name === "AbortError"
          ? "The change took too long. Please try again."
          : e instanceof Error
            ? e.message
            : "The plan could not be changed.",
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }
  const summary = plan ? summarize(plan) : null;
  return (
    <>
      <Navbar />
      <main id="main-content">
        {loading ? (
          <div className="plan-loading" role="status">
            <Sun size={35} className="spin" />
            <h1>A good day is on its way.</h1>
            <p>Opening your itinerary…</p>
          </div>
        ) : !plan ? (
          <div className="plan-empty">
            <Sun size={35} />
            <h1>Your next adventure starts with an idea.</h1>
            <p>{error ?? "There isn't a plan here yet."}</p>
            <Button asChild>
              <Link href="/">
                Plan a new day <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="plan-page">
            <ItineraryHeader plan={plan} persistence={persistence} />
            <div className="mobile-plan-actions">
              <span>
                {summary!.activityCount}{" "}
                {summary!.activityCount === 1 ? "stop" : "stops"} ·{" "}
                {money(summary!.totalCost)} est.
              </span>
              <a href="#day-summary">
                Map & summary <ArrowRight size={13} />
              </a>
            </div>
            {error && (
              <div className="error-state mb-6" role="alert">
                <AlertCircle size={18} />
                <div>
                  <strong>That change didn’t go through.</strong>
                  <p>{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}
            {busy && (
              <div className="planning-status mb-6" role="status">
                <LoaderCircle className="spin" size={20} />
                <div>
                  <strong>Making a little room for something better.</strong>
                  <p>
                    {target
                      ? "Researching an alternative while preserving the rest of your day."
                      : "Updating your plan and checking its constraints."}
                  </p>
                </div>
              </div>
            )}
            <div className="plan-grid">
              <section aria-labelledby="timeline-title">
                <div className="timeline-heading">
                  <h2 id="timeline-title">The shape of your day</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || locked}
                    onClick={() =>
                      refine(
                        "Create a new alternative itinerary with the same date, time window, budget, party size, transportation, and preferences.",
                      )
                    }
                  >
                    <RefreshCw size={12} />
                    Regenerate
                  </Button>
                </div>
                <motion.ol
                  className="timeline"
                  initial={reduced ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {plan.activities.map((activity, index) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      index={index}
                      selected={selected === activity.id}
                      onSelect={() => select(activity.id)}
                      busy={busy || locked}
                      canRemove={plan.activities.length > 1}
                      onRemove={() =>
                        refine("Remove this activity", activity.id, "remove")
                      }
                      onRefine={() => {
                        setError(null);
                        setTarget(activity);
                        setInstruction("");
                      }}
                    />
                  ))}
                </motion.ol>
                <form
                  className="refine-box"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void refine(generalInstruction);
                  }}
                >
                  <h3>A little more you.</h3>
                  <p>
                    Make it slower. Set a new budget. Find a different kind of
                    fun.
                  </p>
                  <label className="sr-only" htmlFor="refine-plan">
                    Changes to your day
                  </label>
                  <textarea
                    id="refine-plan"
                    value={generalInstruction}
                    onChange={(e) => setGeneralInstruction(e.target.value)}
                    placeholder="A slower pace, with more time outdoors…"
                    minLength={3}
                    maxLength={1500}
                    required
                    disabled={busy || locked}
                  />
                  <Button type="submit" disabled={busy || locked}>
                    Refine my day <Sparkles size={14} />
                  </Button>
                </form>
                <details className="sources-list">
                  <summary>
                    Behind your day · {plan.sources.length} research sources
                  </summary>
                  <ul>
                    {plan.sources.map((s) => (
                      <li key={s.url}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              </section>
              <aside
                id="day-summary"
                className="plan-aside"
                aria-label="Map and day summary"
              >
                <ItineraryMap
                  activities={plan.activities}
                  selectedId={selected}
                  onSelect={select}
                  location={plan.location}
                />
                <BudgetSummary
                  plan={plan}
                  busy={busy}
                  onArrange={() => setApproval(true)}
                />
              </aside>
            </div>
            <BookingProgress
              key={bookingRevision}
              plan={plan}
              onLockedChange={setLocked}
            />
            <ApprovalDialog
              onSubmitted={() => {
                setLocked(true);
                setBookingRevision((v) => v + 1);
              }}
              open={approval}
              onOpenChange={setApproval}
              plan={plan}
            />
            <Dialog
              open={!!target}
              onOpenChange={(open) => {
                if (!open && !busy) setTarget(null);
              }}
              title="A change of plans."
              description={
                target
                  ? `Find something else for “${target.name}.” The rest of your day stays in place.`
                  : undefined
              }
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void refine(instruction, target?.id);
                }}
              >
                <label className="sr-only" htmlFor="replacement">
                  What would you prefer?
                </label>
                <textarea
                  className="refine-textarea"
                  id="replacement"
                  placeholder="Something more adventurous, for a little less…"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  minLength={3}
                  maxLength={1500}
                  required
                  disabled={busy || locked}
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    "Something cheaper",
                    "More adventurous",
                    "A slower pace",
                  ].map((text) => (
                    <Button
                      key={text}
                      variant="secondary"
                      size="sm"
                      onClick={() => setInstruction(text)}
                      type="button"
                      disabled={busy || locked}
                    >
                      {text}
                    </Button>
                  ))}
                </div>
                {error && (
                  <p className="error-state" role="alert">
                    {error}
                  </p>
                )}
                <div className="dialog-actions">
                  <Button type="submit" disabled={busy || locked}>
                    {busy ? (
                      <>
                        <LoaderCircle size={14} className="spin" />
                        Finding an alternative
                      </>
                    ) : (
                      <>
                        Find my alternative <ArrowRight size={14} />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Dialog>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
