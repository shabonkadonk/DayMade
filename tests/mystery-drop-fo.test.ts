import { describe, expect, it } from "vitest";
import { foCapabilities, requireFoPurchaseSupport } from "@/lib/mystery-drop/fo-adapter";

describe("Fo Mystery Drop adapter", () => {
  it("does not claim that the discovered tools can make or verify purchases", () => {
    expect(foCapabilities.virtualCards).toBe(false);
    expect(foCapabilities.paymentExecution).toBe(false);
    expect(foCapabilities.transactionLookup).toBe(false);
  });
  it("fails closed before a payment attempt", () => {
    expect(() => requireFoPurchaseSupport()).toThrow(/No purchase was attempted/);
  });
});
