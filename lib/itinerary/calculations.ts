import type { GeneratedPlan } from "./validation";
export function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function summarize(plan: GeneratedPlan) {
  const totalCost =
    Math.round(
      plan.activities.reduce((sum, a) => sum + a.estimatedCost, 0) * 100,
    ) / 100;
  return {
    totalCost,
    remaining: Math.round((plan.budget - totalCost) * 100) / 100,
    travelMinutes: plan.activities.reduce(
      (sum, a) => sum + a.transportationMinutes,
      0,
    ),
    durationMinutes: minutes(plan.endTime) - minutes(plan.startTime),
    activityCount: plan.activities.length,
  };
}
export function constraintErrors(plan: GeneratedPlan): string[] {
  const errors: string[] = [],
    start = minutes(plan.startTime),
    end = minutes(plan.endTime);
  if (end <= start)
    errors.push(
      "The end time must be after the start time. Overnight plans are not yet supported.",
    );
  const ids = new Set<string>();
  plan.activities.forEach((a, index) => {
    if (ids.has(a.id)) errors.push("Activities must have unique identifiers.");
    ids.add(a.id);
    if (minutes(a.endTime) <= minutes(a.startTime))
      errors.push(`${a.name} must have a positive duration.`);
    if (minutes(a.startTime) < start || minutes(a.endTime) > end)
      errors.push(`${a.name} is outside your time window.`);
    const previousEnd = index
      ? minutes(plan.activities[index - 1].endTime)
      : start;
    if (minutes(a.startTime) - a.transportationMinutes < previousEnd)
      errors.push(
        `${a.name} overlaps another activity or leaves too little travel time.`,
      );
  });
  if (summarize(plan).totalCost > plan.budget + 0.005)
    errors.push("Estimated costs exceed the total party budget.");
  return errors;
}
export function replaceActivity(
  plan: GeneratedPlan,
  id: string,
  replacement: GeneratedPlan["activities"][number],
): GeneratedPlan {
  if (!plan.activities.some((a) => a.id === id))
    throw new Error("Activity not found.");
  const updated = {
    ...plan,
    activities: plan.activities.map((a) =>
      a.id === id ? { ...replacement, id } : a,
    ),
  };
  const errors = constraintErrors(updated);
  if (errors.length) throw new Error(errors.join(" "));
  return updated;
}
