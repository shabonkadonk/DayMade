import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  MapPin,
  CalendarDays,
  Users,
  Clock3,
  Info,
} from "lucide-react";
import { displayTime } from "@/lib/utils";
import type { Itinerary } from "@/types/itinerary";
export function ItineraryHeader({
  plan,
  persistence,
}: {
  plan: Itinerary;
  persistence: string;
}) {
  return (
    <>
      {" "}
      <Link href="/" className="back-link">
        <ArrowLeft size={14} />A new kind of day
      </Link>
      <div className="plan-eyebrow">
        <Sparkles size={13} />A DAY WITH YOUR NAME ON IT
      </div>
      <h1 className="plan-title">{plan.title}</h1>
      <p className="plan-description">{plan.description}</p>
      <div className="plan-meta">
        <span>
          <MapPin size={14} />
          {plan.location}
        </span>
        <span>
          <CalendarDays size={14} />
          {new Date(`${plan.date}T12:00:00`).toLocaleDateString("en-US", {
            weekday: "short",
            month: "long",
            day: "numeric",
          })}
        </span>
        <span>
          <Users size={14} />
          {plan.partySize} {plan.partySize === 1 ? "person" : "people"}
        </span>
        <span>
          <Clock3 size={14} />
          {displayTime(plan.startTime)} – {displayTime(plan.endTime)}
        </span>
      </div>
      <div className="plan-notice">
        <Info size={14} />
        <span>
          Research-backed ideas. Costs, travel times, hours, and reservation
          requirements are estimates to confirm with each venue. Nothing is
          booked.
          {persistence === "development_memory" &&
            " Development storage: this plan expires after 24 hours or a server restart."}
        </span>
      </div>
    </>
  );
}
