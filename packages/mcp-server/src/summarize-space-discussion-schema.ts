import { z } from 'zod';

export const summarizeSpaceDiscussionInputSchema = z.object({
  space_slug: z.string().trim().min(1),
});

export const summarizeSpaceDiscussionOutputSchema = z.object({
  ok: z.boolean(),
  summaryId: z.number().optional(),
  messageCount: z.number().optional(),
  participantCount: z.number().optional(),
  error: z.string().optional(),
});
