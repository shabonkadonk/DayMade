import { z } from "zod";

export const dropInputSchema = z.object({
  interests: z.string().trim().min(8).max(1200),
  budgetCents: z.number().int().min(100).max(100000),
  categories: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  exclusions: z.string().trim().max(500).default(""),
  condition: z.enum(["new", "used", "either"]).default("new"),
  delivery: z.string().trim().max(300).default("No special constraints"),
  vibe: z.array(z.enum(["practical", "weird", "nostalgic", "creative", "collectible"])).max(5).default([]),
});

export const productSchema = z.object({
  name: z.string().min(3).max(180),
  merchant: z.string().min(2).max(100),
  url: z.string().url(),
  imageUrl: z.string().url().optional(),
  priceCents: z.number().int().positive(),
  shippingCents: z.number().int().nonnegative().nullable(),
  taxCents: z.number().int().nonnegative().nullable(),
  totalCents: z.number().int().positive().nullable(),
  deliveryEstimate: z.string().max(120).nullable(),
  returnInfo: z.string().max(240).nullable(),
  condition: z.enum(["new", "used", "unknown"]),
  reason: z.string().min(15).max(500),
  evidence: z.string().min(10).max(300),
  score: z.number().int().min(0).max(100),
});

export type DropInput = z.infer<typeof dropInputSchema>;
export type DropProduct = z.infer<typeof productSchema>;
export type DropStatus = "CANDIDATE_SELECTED" | "AWAITING_APPROVAL" | "BLOCKED_UNSUPPORTED";
export interface MysteryDrop {
  id: string;
  ownerHash: string;
  createdAt: string;
  input: DropInput;
  candidates: DropProduct[];
  selected: DropProduct;
  status: DropStatus;
  events: { at: string; type: string; detail: string }[];
}
