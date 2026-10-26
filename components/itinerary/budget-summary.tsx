import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { summarize } from "@/lib/itinerary/calculations";
import { money } from "@/lib/utils";
import type { Itinerary } from "@/types/itinerary";
export function BudgetSummary({
  plan,
  busy,
  onArrange,
}: {
  plan: Itinerary;
  busy: boolean;
  onArrange: () => void;
}) {
  const summary = summarize(plan);
  return (
    <div className="summary-card">
      <h2>A good day, at a glance.</h2>
      <div className="summary-row">
        <span>Little adventures</span>
        <strong>
          {summary.activityCount}{" "}
          {summary.activityCount === 1 ? "stop" : "stops"}
        </strong>
      </div>
      <div className="summary-row">
        <span>Time to explore</span>
        <strong>
          {Math.floor(summary.durationMinutes / 60)}h{" "}
          {summary.durationMinutes % 60 || ""}
          {summary.durationMinutes % 60 ? "m" : ""}
        </strong>
      </div>
      <div className="summary-row">
        <span>Estimated travel</span>
        <strong>
          {summary.travelMinutes} min · {plan.transportation}
        </strong>
      </div>
      <div className="summary-row summary-total">
        <span>Estimated total</span>
        <strong>{money(summary.totalCost)}</strong>
      </div>
      <div
        className="budget-track"
        role="meter"
        aria-label="Estimated budget used"
        aria-valuemin={0}
        aria-valuemax={plan.budget || 1}
        aria-valuenow={summary.totalCost}
      >
        <div
          style={{
            width: `${plan.budget ? Math.min(100, (summary.totalCost / plan.budget) * 100) : 0}%`,
          }}
        />
      </div>
      <p className="summary-caption">
        {money(summary.remaining)} left of your {money(plan.budget)} total party
        budget.
        <br />
        All costs are estimates in USD.
      </p>
      <Button onClick={onArrange} disabled={busy}>
        Arrange my day <ArrowUpRight size={15} />
      </Button>
      <p className="summary-fineprint">
        <ShieldCheck size={12} />
        You review every action first.
      </p>
    </div>
  );
}
