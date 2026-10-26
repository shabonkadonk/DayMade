import { describe, expect, it } from "vitest";
import { purchaseableTotal } from "@/lib/mystery-drop/policy";
import type { DropProduct } from "@/lib/mystery-drop/types";

const candidate: DropProduct = {
  name: "Pocket synthesizer", merchant: "Example Audio", url: "https://example.com/item",
  priceCents: 1200, shippingCents: 200, taxCents: 100, totalCents: 1500,
  deliveryEstimate: null, returnInfo: null, condition: "new", reason: "A small tactile audio tool suits the music production interest.",
  evidence: "The listing shows the current product price.", score: 82,
};

describe("Mystery Drop purchase policy", () => {
  it("adds mandatory known charges and accepts only a total under the hard cap", () => {
    expect(purchaseableTotal(candidate, 1500)).toBe(1500);
    expect(purchaseableTotal(candidate, 1499)).toBeNull();
  });
  it("rejects a changed price snapshot", () => {
    expect(purchaseableTotal({ ...candidate, totalCents: 1499 }, 1600)).toBeNull();
  });
  it("rejects unknown tax or shipping instead of treating it as zero", () => {
    expect(purchaseableTotal({ ...candidate, shippingCents: null }, 2000)).toBeNull();
    expect(purchaseableTotal({ ...candidate, taxCents: null }, 2000)).toBeNull();
  });
  it("rejects a changed mandatory charge even when the old total fitted", () => {
    expect(purchaseableTotal({ ...candidate, shippingCents: 300 }, 1600)).toBeNull();
  });
});
