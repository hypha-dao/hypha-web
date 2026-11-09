import { isAllowedQuestDeliverableUrl } from '@hypha-platform/core/client';
import { z } from 'zod';

export const draftPatchSchema = z.object({
  name: z.string().trim().max(160).optional(),
  goal: z.string().trim().max(4000).optional(),
  scopeIn: z.array(z.string().trim().min(1).max(400)).max(25).optional(),
  scopeOut: z.array(z.string().trim().min(1).max(400)).max(25).optional(),
  successCriteriaBullets: z
    .array(z.string().trim().min(1).max(400))
    .max(20)
    .optional(),
  targetDate: z.string().trim().max(64).optional(),
  leadName: z.string().trim().max(120).optional(),
  rewards: z
    .array(
      z.object({
        amount: z.string().trim().min(1).max(40),
        token: z.string().trim().min(1).max(24),
      }),
    )
    .max(12)
    .optional(),
  milestones: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        dueDate: z.string().trim().max(64).optional(),
        description: z.string().trim().max(1000).optional(),
        ownerName: z.string().trim().max(120).optional(),
      }),
    )
    .max(20)
    .optional(),
  members: z
    .array(
      z.object({
        memberName: z.string().trim().min(1).max(120),
        roleLabel: z.string().trim().max(80).optional(),
        responsibilities: z
          .array(z.string().trim().min(1).max(300))
          .max(15)
          .optional(),
      }),
    )
    .max(30)
    .optional(),
  deliverables: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        url: z
          .string()
          .trim()
          .max(1000)
          .refine(isAllowedQuestDeliverableUrl, {
            message: 'Only http/https URLs are allowed.',
          })
          .optional(),
        note: z.string().trim().max(1000).optional(),
      }),
    )
    .max(30)
    .optional(),
});

export type QuestDraftAssistPatch = z.infer<typeof draftPatchSchema>;
