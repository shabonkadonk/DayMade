import "server-only";

/** Verified capabilities exposed by the installed Wajo Fo MCP server. */
export const foCapabilities = {
  conversations: true,
  calls: true,
  virtualCards: false,
  spendingLimits: false,
  merchantRestrictions: false,
  cardStatus: false,
  paymentExecution: false,
  transactionLookup: false,
  cardDeactivation: false,
} as const;

export function requireFoPurchaseSupport(): never {
  throw new Error(
    "Mystery Drop can find and review products, but Fo currently exposes no card, payment, or transaction verification tools. No purchase was attempted.",
  );
}
