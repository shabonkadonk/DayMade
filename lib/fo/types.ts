import { z } from "zod";
export const foReplySchema = z.object({
  status: z.enum(["working", "complete", "failed"]),
  conversationId: z.string().min(1),
  response: z.string().optional(),
  progress: z.string().optional(),
  elapsedSeconds: z.number().optional(),
});
export type FoReply = z.infer<typeof foReplySchema>;
export interface FoService {
  getCapabilities(): { available: boolean; reason?: string };
  requestReservation(message: string): Promise<FoReply>;
  getTaskStatus(conversationId: string): Promise<FoReply>;
}
