"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FoConnection } from "./fo-connection";
import type { Itinerary } from "@/types/itinerary";
import { money, displayTime } from "@/lib/utils";
import { apiRequest } from "@/lib/api/browser";
export function ApprovalDialog({
  open,
  onOpenChange,
  plan,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: Itinerary;
  onSubmitted?: () => void;
}) {
  const [selected, setSelected] = useState(""),
    [connected, setConnected] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [contactName, setContactName] = useState(""),
    [contactPhone, setContactPhone] = useState("");
  const activities = plan.activities.filter((a) => a.requiresReservation);
  async function submit() {
    if (!connected || !consent || !selected || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/bookings", {
        itineraryId: plan.id,
        revision: plan.revision,
        activityId: selected,
        idempotencyKey: crypto.randomUUID(),
        approval: {
          action: "contact_and_request_reservation",
          consent: true,
          maximumSpend: 0,
          ...(contactName.trim()
            ? {
                contact: {
                  name: contactName.trim(),
                  ...(contactPhone.trim()
                    ? { phone: contactPhone.trim() }
                    : {}),
                },
              }
            : {}),
        },
      });
      setConsent(false);
      onSubmitted?.();
      onOpenChange(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "This request could not be completed. Check Wajo before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          setConsent(false);
          onOpenChange(v);
        }
      }}
      title="Let’s make it happen."
      description="Review the details before sending a live request to your Fo assistant."
    >
      {activities.length ? (
        <>
          <div className="live-request-notice">
            <strong>This sends a real request.</strong>
            <p>
              Fo may contact the restaurant or schedule a call for later if it
              is closed. This is not a simulation. A reservation is only
              confirmed when the restaurant accepts it.
            </p>
          </div>
          <div className="approval-list">
            {activities.map((a) => (
              <label key={a.id} className="approval-item">
                <input
                  type="radio"
                  name="reservation-activity"
                  value={a.id}
                  checked={selected === a.id}
                  onChange={() => {
                    setSelected(a.id);
                    setConsent(false);
                  }}
                />
                <div>
                  <strong>{a.venueName}</strong>
                  <span>
                    Call this business if needed and request a reservation for{" "}
                    {plan.partySize} on {plan.date} at{" "}
                    {displayTime(a.startTime)} (venue local time).
                  </span>
                  <span>{a.address}</span>
                  <span>
                    Experience estimate: {money(a.estimatedCost)} for your
                    party. No payment authorized.
                  </span>
                </div>
              </label>
            ))}
          </div>
          <div className="booking-contact">
            <label htmlFor="reservation-name">
              Reservation name (optional)
            </label>
            <input
              id="reservation-name"
              autoComplete="name"
              maxLength={100}
              value={contactName}
              onChange={(e) => {
                setContactName(e.target.value);
                setConsent(false);
              }}
            />
            <label htmlFor="reservation-phone">
              Callback number (optional, with country code)
            </label>
            <input
              id="reservation-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+16085551234"
              maxLength={16}
              value={contactPhone}
              onChange={(e) => {
                setContactPhone(e.target.value);
                setConsent(false);
              }}
            />
            <p className="form-help">
              Only the name and number you enter here may be shared with the
              selected business. If more details are needed, Fo will ask you.
            </p>
          </div>
          <div className="approval-note">
            <ShieldCheck size={18} />
            <span>
              Maximum authorized spend: <strong>$0.</strong> No purchases,
              deposits, cancellations, or other sharing of personal details.
              Requests needing payment require a separate approval in Wajo.
            </span>
          </div>
        </>
      ) : (
        <div className="approval-note">
          <ShieldCheck size={18} />
          <p>
            No reservations are suggested for this day. Check the venue sources
            for current hours and entry requirements before heading out.
          </p>
        </div>
      )}
      <FoConnection returnTo={`/plan/${plan.id}`} onStatus={setConnected} />
      {activities.length > 0 && (
        <label className="approval-item">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I approve this live call and reservation request, including a call
            scheduled for later if the restaurant is closed
            {contactName.trim()
              ? ", and sharing the contact details entered above"
              : ""}
            . I understand no reservation is guaranteed.
          </span>
        </label>
      )}
      {error && (
        <p className="error-state" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setConsent(false);
            onOpenChange(false);
          }}
        >
          Back to my day
        </Button>
        {activities.length > 0 && (
          <Button
            disabled={
              !connected ||
              !selected ||
              !consent ||
              busy ||
              (!!contactPhone.trim() && !contactName.trim())
            }
            onClick={submit}
          >
            {busy ? "Sending approved request…" : "Send live request to Fo"}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
