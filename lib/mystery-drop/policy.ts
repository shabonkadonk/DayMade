import type { DropProduct } from "./types";

export function purchaseableTotal(product: DropProduct, maximumCents: number): number | null {
  if (product.shippingCents === null || product.taxCents === null) return null;
  const total = product.priceCents + product.shippingCents + product.taxCents;
  if (product.totalCents !== total || total > maximumCents) return null;
  return total;
}
