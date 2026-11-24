import { z } from 'zod';
import type { QuestItem } from '@hypha-platform/core/server';
import { sanitiseUserText } from '../sanitiser';
import { userText } from './user-text';

export const QUEST_STATUSES = [
  'active',
  'proposed',
  'paused',
  'completed',
  'archived',
] as const;
export type QuestTextMode = 'none' | 'excerpt' | 'full';

export const QUEST_TEXT_CAPS = {
  name: 200,
  short: 200,
  responsibility: 800,
  note: 1_000,
  healthSummary: 500,
  /** About 500 characters: the default view of the long texts. */
  excerpt: 500,
  /** The creation limit of the long texts is 20,000 characters. */
  fullLong: 20_000,
  /** The creation limit of a milestone description is 10,000 characters. */
  fullMilestone: 10_000,
  amount: 40,
  symbol: 24,
  url: 500,
} as const;

type LongKey = 'goal' | 'scopeIn' | 'scopeOut' | 'successCriteria';
type QuestTextKey = 'name' | 'lead' | 'healthSummary' | LongKey;

const clean = (value: string, max: number): string =>
  sanitiseUserText(value, max).text;

/**
 * A link a person attached to a deliverable. Only a plain web link is returned; anything
 * else (another scheme, credentials in the address, control characters) is dropped.
 */
export function safeWebLink(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > QUEST_TEXT_CAPS.url) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s<>"'`\\]/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const milestoneSchema = z.object({
  order: z.number(),
  status: z.enum(['not_started', 'in_progress', 'done']),
  dueDate: z.string().nullable(),
  userText: z.object({
    name: z.string().nullable(),
    ownerName: z.string().nullable(),
    /** Absent when `text` is `none`. */
    description: z.string().nullable().optional(),
    truncated: z.array(z.enum(['name', 'ownerName', 'description'])),
  }),
});

export const questItemSchema = z.object({
  slug: z.string(),
  url: z.string(),
  /** The stored status. A read never changes it. */
  status: z.enum(QUEST_STATUSES),
  targetDate: z.string().nullable(),
  rewards: z.array(
    z.object({ amount: z.string(), token: z.string().nullable() }),
  ),
  userText: z.object({
    name: z.string().nullable(),
    lead: z.string().nullable(),
    healthSummary: z.string().nullable(),
    /** The long texts are absent when `text` is `none`. */
    goal: z.string().nullable().optional(),
    scopeIn: z.string().nullable().optional(),
    scopeOut: z.string().nullable().optional(),
    successCriteria: z.string().nullable().optional(),
    truncated: z.array(
      z.enum([
        'name',
        'lead',
        'healthSummary',
        'goal',
        'scopeIn',
        'scopeOut',
        'successCriteria',
      ]),
    ),
  }),
  members: z.array(
    z.object({
      isLead: z.boolean(),
      responsibilities: z.array(z.string()),
      userText: z.object({
        name: z.string().nullable(),
        role: z.string().nullable(),
        truncated: z.array(z.enum(['name', 'role'])),
      }),
    }),
  ),
  milestones: z.array(milestoneSchema),
  deliverables: z.array(
    z.object({
      /** A plain web link a person attached, or `null`. */
      url: z.string().nullable(),
      userText: z.object({
        name: z.string().nullable(),
        note: z.string().nullable(),
        truncated: z.array(z.enum(['name', 'note'])),
      }),
    }),
  ),
  health: z.object({
    state: z.enum(['on_track', 'at_risk', 'off_track']),
    marker: z.number(),
    updatesThisWeek: z.number(),
    lastUpdateAt: z.string().nullable(),
    daysToTarget: z.number().nullable(),
  }),
  /** The proposal that commits the quest; its `status` is only set on request. */
  proposal: z
    .object({
      slug: z.string(),
      url: z.string(),
      status: z
        .enum(['onVoting', 'accepted', 'rejected', 'withdrawn'])
        .nullable(),
    })
    .nullable(),
  acceptedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  viewer: z.object({ isLead: z.boolean(), isMember: z.boolean() }),
});
export type QuestPresented = z.infer<typeof questItemSchema>;

export const questCountsSchema = z.object({
  active: z.number(),
  proposed: z.number(),
  paused: z.number(),
  completed: z.number(),
  archived: z.number(),
  total: z.number(),
});

/**
 * MCP's own presentation model over a feature function's quest. Everything a person wrote is
 * sanitised and capped; the long texts and the milestone descriptions follow `text`. Names
 * are display names only: no person id, address, avatar or chat room is part of the model.
 */
export function presentQuest(
  item: QuestItem,
  ctx: {
    url: string;
    proposalUrl(slug: string): string;
    text: QuestTextMode;
  },
): QuestPresented {
  const long =
    ctx.text === 'full' ? QUEST_TEXT_CAPS.fullLong : QUEST_TEXT_CAPS.excerpt;
  const longField = (value: string) => ({
    atWordBoundary: true,
    value: ctx.text === 'none' ? null : value,
    max: long,
  });
  const text = userText<QuestTextKey>({
    name: { value: item.name, max: QUEST_TEXT_CAPS.name },
    lead: { value: item.lead, max: QUEST_TEXT_CAPS.short },
    healthSummary: {
      value: item.health.summary === '' ? null : item.health.summary,
      max: QUEST_TEXT_CAPS.healthSummary,
    },
    goal: longField(item.goal),
    scopeIn: longField(item.scopeIn),
    scopeOut: longField(item.scopeOut),
    successCriteria: longField(item.successCriteria),
  });
  if (ctx.text === 'none') {
    delete (text as Partial<typeof text>).goal;
    delete (text as Partial<typeof text>).scopeIn;
    delete (text as Partial<typeof text>).scopeOut;
    delete (text as Partial<typeof text>).successCriteria;
  }

  return {
    slug: item.slug,
    url: ctx.url,
    status: item.status,
    targetDate: item.targetDate,
    rewards: item.rewards.map((reward) => ({
      amount: clean(reward.amount, QUEST_TEXT_CAPS.amount),
      token:
        reward.token === null
          ? null
          : clean(reward.token, QUEST_TEXT_CAPS.symbol),
    })),
    userText: text as QuestPresented['userText'],
    members: item.members.map((member) => ({
      isLead: member.isLead,
      responsibilities: member.responsibilities.map((line) =>
        clean(line, QUEST_TEXT_CAPS.responsibility),
      ),
      userText: userText<'name' | 'role'>({
        name: { value: member.name, max: QUEST_TEXT_CAPS.short },
        role: { value: member.role, max: QUEST_TEXT_CAPS.short },
      }),
    })),
    milestones: item.milestones.map((milestone) => {
      const t = userText<'name' | 'ownerName' | 'description'>({
        name: { value: milestone.name, max: QUEST_TEXT_CAPS.name },
        ownerName: { value: milestone.ownerName, max: QUEST_TEXT_CAPS.short },
        description: {
          atWordBoundary: true,
          value: ctx.text === 'none' ? null : milestone.description,
          max:
            ctx.text === 'full'
              ? QUEST_TEXT_CAPS.fullMilestone
              : QUEST_TEXT_CAPS.excerpt,
        },
      });
      if (ctx.text === 'none') delete (t as Partial<typeof t>).description;
      return {
        order: milestone.order,
        status: milestone.status,
        dueDate: milestone.dueDate,
        userText: t as QuestPresented['milestones'][number]['userText'],
      };
    }),
    deliverables: item.deliverables.map((deliverable) => ({
      url: safeWebLink(deliverable.url),
      userText: userText<'name' | 'note'>({
        name: { value: deliverable.name, max: QUEST_TEXT_CAPS.name },
        note: { value: deliverable.note, max: QUEST_TEXT_CAPS.note },
      }),
    })),
    health: {
      state: item.health.state,
      marker: item.health.marker,
      updatesThisWeek: item.health.updatesThisWeek,
      lastUpdateAt: item.health.lastUpdateAt,
      daysToTarget: item.health.daysToTarget,
    },
    proposal: item.proposal
      ? {
          slug: item.proposal.slug,
          url: ctx.proposalUrl(item.proposal.slug),
          status: item.proposal.status,
        }
      : null,
    acceptedAt: item.acceptedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    viewer: item.viewer,
  };
}
