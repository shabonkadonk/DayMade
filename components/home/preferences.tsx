"use client";
import {
  CalendarDays,
  MapPin,
  Wallet,
  Users,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import type { Preferences } from "@/types/itinerary";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";
export function PreferenceControls({
  value,
  onChange,
}: {
  value: Preferences;
  onChange: (v: Preferences) => void;
}) {
  const [open, setOpen] = useState(false);
  const chips = [
    { Icon: MapPin, label: value.location || "Where to?" },
    {
      Icon: CalendarDays,
      label: value.date
        ? new Date(`${value.date}T12:00:00`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "Any day",
    },
    {
      Icon: Wallet,
      label:
        value.budget !== undefined
          ? `${money(value.budget)} total`
          : "Any budget",
    },
    {
      Icon: Users,
      label: value.partySize
        ? `${value.partySize} ${value.partySize === 1 ? "person" : "people"}`
        : "Your people",
    },
  ];
  return (
    <>
      <div className="preference-row">
        {chips.map(({ Icon, label }) => (
          <button
            type="button"
            className="preference-chip"
            key={Icon.displayName ?? label}
            onClick={() => setOpen(true)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
        <button
          type="button"
          className="preference-more"
          aria-label="More preferences"
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal size={17} />
        </button>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="The little details."
        description="Add what matters. You can also include any of these in your request."
      >
        <div className="form-grid">
          <label className="field field-wide">
            City or neighborhood
            <input
              value={value.location}
              placeholder="e.g. San Francisco, CA"
              maxLength={120}
              onChange={(e) => onChange({ ...value, location: e.target.value })}
            />
          </label>
          <label className="field">
            Date
            <input
              type="date"
              value={value.date ?? ""}
              onChange={(e) =>
                onChange({ ...value, date: e.target.value || undefined })
              }
            />
          </label>
          <label className="field">
            Total budget (USD)
            <input
              type="number"
              min={0}
              max={100000}
              placeholder="Let my request decide"
              value={value.budget ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  budget:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
          <label className="field">
            Start time
            <input
              type="time"
              value={value.startTime ?? ""}
              onChange={(e) =>
                onChange({ ...value, startTime: e.target.value || undefined })
              }
            />
          </label>
          <label className="field">
            End time
            <input
              type="time"
              value={value.endTime ?? ""}
              onChange={(e) =>
                onChange({ ...value, endTime: e.target.value || undefined })
              }
            />
          </label>
          <label className="field">
            People
            <input
              type="number"
              min={1}
              max={30}
              placeholder="Let my request decide"
              value={value.partySize ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  partySize:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
          <label className="field">
            Getting around
            <select
              value={value.transportation ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  transportation: (e.target.value ||
                    undefined) as Preferences["transportation"],
                })
              }
            >
              <option value="">Let my request decide</option>
              <option value="walking">Walking</option>
              <option value="transit">Public transit</option>
              <option value="driving">Driving</option>
              <option value="cycling">Cycling</option>
            </select>
          </label>
        </div>
        <div className="dialog-actions">
          <Button variant="ghost" onClick={() => onChange({ location: "" })}>
            Reset
          </Button>
          <Button onClick={() => setOpen(false)}>Looks good</Button>
        </div>
      </Dialog>
    </>
  );
}
