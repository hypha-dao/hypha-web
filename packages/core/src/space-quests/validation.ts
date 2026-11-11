import { z } from 'zod';
import {
  QUEST_HEALTH_STATES,
  QUEST_MILESTONE_STATUSES,
  QUEST_PATCH_STATUSES,
  QUEST_STEWARD_STEPS,
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

/** Stable API code for a deliverable link that is not http(s). */
export const QUEST_DELIVERABLE_URL_CODE = 'deliverable_url';

/** English fallback. Quest pages translate this for the URL field. */
export const QUEST_DELIVERABLE_URL_MESSAGE =
  'Enter a link starting with http:// or https://';

const questDeliverableUrl = z
  .string()
  .trim()
  .max(1000)
  .refine(isAllowedQuestDeliverableUrl, {
    message: QUEST_DELIVERABLE_URL_MESSAGE,
  });

export type QuestSchemaErrorBody = {
  error: string;
  code?: string;
  path?: Array<string | number>;
};

function issuePath(path: ReadonlyArray<PropertyKey>): string[] {
  return path.map((part) => String(part));
}

function isDeliverableUrlPath(path: ReadonlyArray<PropertyKey>): boolean {
  const parts = issuePath(path);
  return parts.includes('deliverables') && parts.includes('url');
}

/** Field-aware body for a failed quest schema parse. Never the raw Zod JSON. */
export function questSchemaErrorPayload(
  error: z.ZodError,
): QuestSchemaErrorBody {
  const urlIssue = error.issues.find((issue) =>
    isDeliverableUrlPath(issue.path),
  );
  if (urlIssue) {
    return {
      error: QUEST_DELIVERABLE_URL_MESSAGE,
      code: QUEST_DELIVERABLE_URL_CODE,
      path: urlIssue.path.flatMap((part) =>
        typeof part === 'string' || typeof part === 'number' ? [part] : [],
      ),
    };
  }
  const messages = [
    ...new Set(
      error.issues
        .map((issue) => issue.message.trim())
        .filter((message) => message.length > 0),
    ),
  ];
  return {
    error: messages.join(' ') || 'Check the form and try again.',
  };
}

/**
 * Turn a Zod issue dump into the issue messages. Other text is unchanged.
 * Deliverable URL issues use the field sentence.
 */
export function readableQuestErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return message;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const issues = Array.isArray(parsed) ? parsed : [parsed];
    const messages = issues.flatMap((issue) => {
      if (!issue || typeof issue !== 'object') return [];
      const record = issue as { message?: unknown; path?: unknown };
      const path = Array.isArray(record.path) ? record.path : [];
      if (isDeliverableUrlPath(path)) return [QUEST_DELIVERABLE_URL_MESSAGE];
      return typeof record.message === 'string' && record.message.trim()
        ? [record.message.trim()]
        : [];
    });
    if (messages.length === 0) return message;
    return [...new Set(messages)].join(' ');
  } catch {
    return message;
  }
}

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
  deliverables: z.array(schemaQuestDeliverableInput).max(40).default([]),
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
  deliverablesEnabled: z.boolean().optional(),
  healthState: z.enum(QUEST_HEALTH_STATES).optional(),
  healthMarker: z.number().int().min(0).max(100).optional(),
  healthSummary: z.string().max(4000).optional(),
  milestones: z.array(schemaQuestMilestoneInput).max(30).optional(),
  members: z.array(schemaQuestMemberInput).max(50).optional(),
  deliverables: z.array(schemaQuestDeliverableInput).max(40).optional(),
});

const questDraftMessage = z.object({
  id: z.string().trim().min(1).max(80),
  role: z.enum(['user', 'member']),
  text: z.string().max(8_000),
  timestamp: z.string().max(40),
  senderName: z.string().max(120).optional(),
  senderMatrixId: z.string().max(200).optional(),
  avatarUrl: z.string().max(500).optional(),
  agentSpecialistId: z.string().max(80).optional(),
});

const questDraftMilestone = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().max(160),
  description: z.string().max(10_000).optional().default(''),
  dueDate: z.string().max(64).nullable().optional(),
  ownerPersonId: z.number().int().nullable().optional(),
  ownerName: z.string().max(120).nullable().optional(),
  status: z.enum(QUEST_MILESTONE_STATUSES).optional(),
  insertedNew: z.boolean().optional(),
  wasOrder: z.number().int().optional(),
});

const questDraftMember = z.object({
  id: z.number().int().positive().optional(),
  personId: z.number().int().nullable().optional(),
  memberName: z.string().max(120),
  memberAvatarUrl: z.string().max(500).nullable().optional(),
  roleLabel: z.string().max(80).nullable().optional(),
  responsibilities: z.array(z.string().max(400)).max(25).optional().default([]),
});

/** Create-quest form, Helper thread, and a waiting suggestion card. */
export const schemaQuestCreateDraftPayload = z.object({
  draft: z.object({
    name: z.string().max(200),
    goal: z.string().max(10_000),
    scopeIn: z.array(z.string().max(500)).max(50),
    scopeOut: z.array(z.string().max(500)).max(50),
    scopeInMarkdown: z.string().max(10_000),
    scopeOutMarkdown: z.string().max(10_000),
    successCriteria: z.string().max(10_000),
    rewards: z
      .array(
        z.object({
          amount: z.string().max(40),
          token: z.string().max(40),
        }),
      )
      .max(12),
    milestones: z.array(questDraftMilestone).max(30),
    leadName: z.string().max(120),
    selectedLeadPersonId: z.number().int().positive().nullable(),
    members: z.array(questDraftMember).max(50),
    targetDate: z.string().max(64).nullable(),
    deliverables: z
      .array(
        z.object({
          id: z.number().int().positive().optional(),
          name: z.string().max(200),
          url: z.string().max(1000).nullable().optional(),
          note: z.string().max(1000).nullable().optional(),
        }),
      )
      .max(40)
      .optional(),
  }),
  messages: z.array(questDraftMessage).max(40),
  step: z.number().int().min(0).max(20),
  pending: z
    .object({
      step: z.enum(QUEST_STEWARD_STEPS),
      patch: z.record(z.string(), z.unknown()),
    })
    .nullable(),
});

export const schemaSaveQuestDraft = z.object({
  id: z.number().int().positive().optional(),
  payload: schemaQuestCreateDraftPayload,
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
