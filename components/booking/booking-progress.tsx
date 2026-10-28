"use client";
import { useCallback, useEffect, useState } from "react";
import { Clock3, Phone, ShieldCheck, ArrowUpRight } from "lucide-react";
import { bookingPresentation } from "@/lib/bookings/presentation";
import type { Itinerary } from "@/types/itinerary";
import { displayTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/browser";
import type { PublicBooking } from "@/types/booking";
export function BookingProgress({
  plan,
  onLockedChange,
}: {
  plan: Itinerary;
  onLockedChange?: (locked: boolean) => void;
}) {
  const id = plan.id;
  const [bookings, setBookings] = useState<PublicBooking[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    (signal?: AbortSignal) =>
      apiRequest<{ bookings: PublicBooking[] }>(
        `/api/itineraries/${id}/bookings`,
        undefined,
        signal,
      )
        .then((r) => {
          if (signal?.aborted) return;
          setBookings(r.bookings);
          onLockedChange?.(r.bookings.length > 0);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        }),
    [id, onLockedChange],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  async function refresh() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      for (const booking of bookings.filter((b) =>
        [
          "in_progress",
          "requires_user_action",
          "awaiting_confirmation",
        ].includes(b.status),
      )) {
        await apiRequest(`/api/bookings/${booking.id}`, {});
      }
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Progress could not be checked.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!bookings.length && !error) return null;
  return (
    <section className="booking-progress" aria-label="Fo requests">
      <h2>Your arrangements</h2>
      <p className="arrangements-intro">
        See what you asked Fo to do, what its latest update means, and what to
        do next.
      </p>
      {bookings.map((booking) => {
        const summary = bookingPresentation(booking);
        const activity = plan.activities.find(
          (a) => a.id === booking.activityId,
        );
        const date = new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${plan.date}T12:00:00Z`));
        return (
          <article
            className="arrangement-card"
            key={booking.id}
            aria-label={activity?.venueName ?? "Reservation request"}
          >
            <div className="arrangement-heading">
              <span className="arrangement-tag">
                <Phone size={13} /> Live request
              </span>
              <span className="arrangement-confirmation">
                {summary.reservation}
              </span>
            </div>
            <h3>{summary.title}</h3>
            <p className="arrangement-explanation">{summary.explanation}</p>
            <p className="arrangement-request-label">What you approved</p>
            <dl className="arrangement-facts">
              <div>
                <dt>Restaurant</dt>
                <dd>
                  {activity?.venueName ?? "See your approved request in Wajo"}
                </dd>
              </div>
              <div>
                <dt>Table requested for</dt>
                <dd>
                  {date}
                  {activity ? ` at ${displayTime(activity.startTime)}` : ""}
                  <small>
                    Venue local time · {plan.partySize}{" "}
                    {plan.partySize === 1 ? "person" : "people"}
                  </small>
                </dd>
              </div>
              <div>
                <dt>Reservation name</dt>
                <dd>{booking.approvedContact?.name ?? "No name shared"}</dd>
              </div>
              <div>
                <dt>Phone call</dt>
                <dd>{summary.call}</dd>
              </div>
            </dl>
            {summary.evidence && (
              <div className="arrangement-timing">
                <Clock3 size={18} />
                <div>
                  <strong>Call timing reported by Fo</strong>
                  <blockquote>{summary.evidence}</blockquote>
                  <small>
                    This is the planned phone call. Your requested reservation
                    date and time are shown above.
                  </small>
                </div>
              </div>
            )}
            <div className="arrangement-next">
              <strong>What happens next</strong>
              <p>{summary.next}</p>
            </div>
            <details className="arrangement-message">
              <summary>Read Fo’s full message</summary>
              <p>{booking.message}</p>
            </details>
            <div className="arrangement-footer">
              <span>
                <ShieldCheck size={14} /> You approved contacting this venue
                {booking.approvedContact
                  ? " and sharing the contact details you entered"
                  : ""}
                . No payment authorized.
              </span>
              <small>
                Approved {new Date(booking.approvedAt).toLocaleString()}
                <br />
                Last checked {new Date(booking.updatedAt).toLocaleString()}
              </small>
            </div>
          </article>
        );
      })}
      {bookings.length > 0 && (
        <p className="arrangement-lock-note">
          Your itinerary is locked so it continues to match your approved
          requests. Editing this page or disconnecting Fo does not cancel a
          scheduled call. Manage or stop the task in Wajo.
        </p>
      )}
      {error && (
        <p className="error-state" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        {bookings.some((b) =>
          [
            "in_progress",
            "requires_user_action",
            "awaiting_confirmation",
          ].includes(b.status),
        ) && (
          <Button variant="secondary" onClick={refresh} disabled={busy}>
            {busy ? "Checking…" : "Check for an update"}
          </Button>
        )}
        <a
          className="text-link arrangement-manage"
          href="https://wajo.ai"
          target="_blank"
          rel="noreferrer"
        >
          Manage request in Wajo <ArrowUpRight size={15} />
        </a>
      </div>
    </section>
  );
}
