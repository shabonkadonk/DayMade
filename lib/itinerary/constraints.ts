import type { Preferences } from "./validation";
// Conservative hints, not a substitute for Claude's interpretation. Only extract explicit values.
export function parsePromptHints(prompt: string): Partial<Preferences> {
  const hints: Partial<Preferences> = {};
  const budget = prompt.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (budget) hints.budget = Number(budget[1]);
  const party = prompt.match(
    /(?:for|with|party of)\s+(\d+)\s*(?:people|friends|guests|adults)/i,
  );
  if (party && Number(party[1]) <= 30) hints.partySize = Number(party[1]);
  if (/\b(walk|walking|on foot)\b/i.test(prompt))
    hints.transportation = "walking";
  if (/\b(public transit|bus|train)\b/i.test(prompt))
    hints.transportation = "transit";
  return hints;
}
