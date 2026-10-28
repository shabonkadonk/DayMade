"use client";
import {
  MapPin,
  Clock3,
  ExternalLink,
  Footprints,
  Utensils,
  Trees,
  Palette,
  Compass,
  Coffee,
  ShoppingBag,
  RefreshCw,
  Trash2,
  CircleCheck,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayTime, money, cn } from "@/lib/utils";
import type { Activity } from "@/types/itinerary";
import { minutes } from "@/lib/itinerary/calculations";
const icons = {
  food: Utensils,
  outdoors: Trees,
  culture: Palette,
  adventure: Compass,
  relax: Coffee,
  shopping: ShoppingBag,
};
export function ActivityCard({
  activity,
  index,
  selected,
  busy,
  onSelect,
  onRefine,
  onRemove,
  canRemove,
}: {
  activity: Activity;
  index: number;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onRefine: (instruction?: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const Icon = icons[activity.category];
  return (
    <li className="timeline-item">
      <div className="timeline-time">
        <span className="timeline-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span>{displayTime(activity.startTime)}</span>
      </div>
      <div>
        <article className={cn("activity-card", selected && "is-selected")}>
          <div className="activity-card-top">
            <span className="activity-category">
              <Icon size={13} />
              {activity.category}
            </span>
            <span className="activity-cost">
              {activity.estimatedCost === 0
                ? "Free · est."
                : `${money(activity.estimatedCost)} est.`}
            </span>
          </div>
          <h3>
            <button
              onClick={onSelect}
              aria-pressed={selected}
              className="text-left hover:text-primary"
            >
              {activity.name}
            </button>
          </h3>
          <p className="activity-venue">{activity.venueName}</p>
          <p className="activity-description">{activity.description}</p>
          <div className="activity-detail">
            <span>
              <Clock3 size={13} />
              {displayTime(activity.startTime)} –{" "}
              {displayTime(activity.endTime)} ·{" "}
              {minutes(activity.endTime) - minutes(activity.startTime)} min
            </span>
            {selected && (
              <>
                <span>
                  <MapPin size={13} />
                  {activity.address ||
                    "Check the venue’s source for its address."}
                </span>
                <span>Hours, prices, and availability need confirmation.</span>
                {activity.sourceUrl && (
                  <a
                    href={activity.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={12} />
                    View research source
                  </a>
                )}
              </>
            )}
          </div>
          <div className="activity-actions">
            <span
              className={cn(
                "booking-badge",
                activity.requiresReservation && "needed",
              )}
            >
              {activity.requiresReservation ? (
                <>
                  <CalendarClock size={11} />
                  Nothing booked yet
                </>
              ) : (
                <>
                  <CircleCheck size={11} />
                  No reservation suggested
                </>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onRefine()}
              aria-label={`Replace ${activity.name}`}
            >
              <RefreshCw size={12} />
              Swap
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={busy || !canRemove}
              onClick={onRemove}
              aria-label={`Remove ${activity.name}`}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        </article>
        {activity.transportationMinutes > 0 && (
          <div className="travel-gap">
            <Footprints size={12} />
            {activity.transportationMinutes} min travel before this stop ·
            estimated
          </div>
        )}
      </div>
    </li>
  );
}
