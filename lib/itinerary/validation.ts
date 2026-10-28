import { z } from "zod";
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const preferencesSchema = z.object({
  location: z.string().trim().max(120).default(""),
  date: z.iso.date().optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  budget: z.number().min(0).max(100000).optional(),
  partySize: z.number().int().min(1).max(30).optional(),
  transportation: z
    .enum(["walking", "transit", "driving", "cycling"])
    .optional(),
});
export const planRequestSchema = z.object({
  prompt: z.string().trim().min(10).max(3000),
  preferences: preferencesSchema,
});
export const activitySchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(160),
  description: z.string().max(700),
  venueName: z.string().max(160),
  address: z.string().max(300),
  startTime: timeSchema,
  endTime: timeSchema,
  estimatedCost: z.number().min(0).max(100000),
  category: z.enum([
    "food",
    "outdoors",
    "culture",
    "adventure",
    "relax",
    "shopping",
  ]),
  transportationMinutes: z.number().int().min(0).max(240),
  requiresReservation: z.boolean(),
  sourceUrl: z.string().nullable(),
  coordinates: z
    .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
    .nullable(),
});
export const generatedPlanSchema = z.object({
  title: z.string().min(1).max(140),
  description: z.string().max(800),
  location: z.string().min(1).max(120),
  date: z.iso.date(),
  startTime: timeSchema,
  endTime: timeSchema,
  budget: z.number().min(0).max(100000),
  partySize: z.number().int().min(1).max(30),
  transportation: z.enum(["walking", "transit", "driving", "cycling"]),
  preferences: z.array(z.string().max(80)).max(12),
  activities: z.array(activitySchema).min(1).max(12),
});
// Geographic coordinates come from geocoding, never from the language model.
// Omitting tuples also keeps the wire schema inside Anthropic's supported JSON Schema subset.
export const plannerOutputSchema = generatedPlanSchema.extend({
  activities: z
    .array(activitySchema.omit({ coordinates: true }))
    .min(1)
    .max(12),
});
export const itinerarySchema = generatedPlanSchema.extend({
  id: z.uuid(),
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  sources: z.array(z.object({ title: z.string(), url: z.url() })),
  verificationStatus: z.literal("research_backed_estimates"),
});
export const refineRequestSchema = z.object({
  itineraryId: z.uuid(),
  revision: z.number().int().positive(),
  activityId: z.string().max(100).optional(),
  instruction: z.string().trim().min(3).max(1500),
  operation: z.enum(["refine", "remove"]).default("refine"),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export type PlanRequest = z.infer<typeof planRequestSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type GeneratedPlan = z.infer<typeof generatedPlanSchema>;
export type Itinerary = z.infer<typeof itinerarySchema>;
