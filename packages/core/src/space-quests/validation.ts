import { z } from 'zod';
import {
  QUEST_HEALTH_STATES,
  QUEST_MILESTONE_STATUSES,
  QUEST_PATCH_STATUSES,
} from './constants';

export const schemaQuestReward = z.object({
  amount: z.string().trim().max(40),
  token: z.string().trim().min(1).max(24),
});

export const schemaQuestMilestoneInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(10_000).default(''),
  dueDate: z.string().trim().max(64).nullable().optional(),
  ownerPersonId: z.number().int().positive().nullable().optional(),
  ownerName: z.string().trim().max(120).nullable().optional(),
  status: z.enum(QUEST_MILESTONE_STATUSES).optional().default('not_started'),
});

export const schemaQuestMemberInput = z.object({
  id: z.number().int().positive().optional(),
  personId: z.number().int().positive().nullable().optional(),
  memberName: z.string().trim().min(1).max(120),
  memberAvatarUrl: z.string().trim().max(500).nullable().optional(),
  roleLabel: z.string().trim().max(80).nullable().optional(),
  responsibilities: z
    .array(z.string().trim().min(1).max(400))
    .max(25)
    .default([]),
});

/** Blank is allowed. Any other value must be an http(s) URL. */
export function isAllowedQuestDeliverableUrl(value: string): boolean {
  return value.length === 0 || /^https?:\/\//i.test(value);
}

const questDeliverableUrl = z
  .string()
  .trim()
  .max(1000)
  .refine(isAllowedQuestDeliverableUrl, {
    message: 'Only http/https URLs are allowed.',
  });

export const schemaQuestDeliverableInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(200),
  url: questDeliverableUrl.nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const schemaCreateSpaceQuest = z.object({
  name: z.string().trim().min(1).max(160),
  goal: z.string().max(10_000).default(''),
  scopeIn: z.array(z.string().trim().max(500)).max(50).default([]),
  scopeOut: z.array(z.string().trim().max(500)).max(50).default([]),
  scopeInMarkdown: z.string().max(10_000).optional(),
  scopeOutMarkdown: z.string().max(10_000).optional(),
  successCriteria: z.string().max(10_000).default(''),
  rewards: z.array(schemaQuestReward).max(12).default([]),
  targetDate: z.string().trim().max(64).nullable().optional(),
  leadPersonId: z.number().int().positive().nullable().optional(),
  leadName: z.string().trim().max(120).default(''),
  // Quests only become active when their Agreements proposal passes.
  status: z.literal('proposed').optional().default('proposed'),
  milestones: z.array(schemaQuestMilestoneInput).max(30).default([]),
  members: z.array(schemaQuestMemberInput).max(50).default([]),
});

export const schemaPatchSpaceQuest = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  goal: z.string().max(10_000).optional(),
  scopeIn: z.array(z.string().trim().max(500)).max(50).optional(),
  scopeOut: z.array(z.string().trim().max(500)).max(50).optional(),
  scopeInMarkdown: z.string().max(10_000).optional(),
  scopeOutMarkdown: z.string().max(10_000).optional(),
  successCriteria: z.string().max(10_000).optional(),
  rewards: z.array(schemaQuestReward).max(12).optional(),
  targetDate: z.string().trim().max(64).nullable().optional(),
  leadPersonId: z.number().int().positive().nullable().optional(),
  leadName: z.string().trim().max(120).optional(),
  status: z.enum(QUEST_PATCH_STATUSES).optional(),
  proposalDocumentId: z.number().int().positive().nullable().optional(),
  stewardHealthSummaries: z.boolean().optional(),
  memberUpdateAlerts: z.boolean().optional(),
  healthState: z.enum(QUEST_HEALTH_STATES).optional(),
  healthMarker: z.number().int().min(0).max(100).optional(),
  healthSummary: z.string().max(4000).optional(),
  milestones: z.array(schemaQuestMilestoneInput).max(30).optional(),
  members: z.array(schemaQuestMemberInput).max(50).optional(),
  deliverables: z.array(schemaQuestDeliverableInput).max(40).optional(),
});

export const schemaPostQuestUpdate = z.object({
  text: z.string().trim().min(1).max(2000),
  milestoneOrder: z.number().int().positive().nullable().optional(),
  milestoneLabel: z.string().trim().max(24).nullable().optional(),
  links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        url: z.string().trim().min(1).max(1000),
        kind: z.enum(['pr', 'preview', 'doc', 'link']).optional(),
      }),
    )
    .max(8)
    .default([]),
});
