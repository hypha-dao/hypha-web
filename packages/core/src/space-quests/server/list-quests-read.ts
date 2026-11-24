import { and, asc, desc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import {
  spaceQuestDeliverables,
  spaceQuestMembers,
  spaceQuestMilestones,
  spaceQuests,
  spaceQuestUpdates,
  type SpaceQuest,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import { parseQuestCalendarDate } from '../calendar-date';
import {
  isQuestHealthState,
  isQuestMilestoneStatus,
  isQuestStatus,
  type QuestHealthState,
  type QuestStatus,
} from '../constants';
import { computeQuestHealth } from '../health-display';
import {
  bulletsToMarkdownList,
  stripViewerYouMarker,
  withoutPlaceholderLeadDuplicates,
} from '../markdown';
import type {
  QuestDeliverableRecord,
  QuestMemberRecord,
  QuestMilestoneRecord,
  QuestReward,
} from '../types';

/**
 * The read behind the quest list of the MCP: one page of quests, with filters, counts and
 * paging done by the database, and the parts (milestones, members, deliverables) loaded only
 * for the quests on that page. The update history is never loaded: health needs only a count
 * of this week's updates and the time of the latest one. It writes nothing and never reads
 * drafts. Every query carries one space id that the caller has already checked with the
 * access policy.
 */

export type QuestListingFilter = {
  spaceId: number;
  /** Only quests where this person is the lead or a member. */
  mineOfPersonId?: number;
  /** The stored status. */
  status?: QuestStatus;
  includeArchived?: boolean;
  offset: number;
  limit: number;
};

export type QuestListingRecord = {
  id: number;
  slug: string;
  name: string;
  status: QuestStatus;
  goal: string;
  scopeInMarkdown: string;
  scopeOutMarkdown: string;
  successCriteria: string;
  rewards: QuestReward[];
  targetDate: string | null;
  leadPersonId: number | null;
  /** As stored; empty when none. */
  leadName: string;
  members: QuestMemberRecord[];
  milestones: QuestMilestoneRecord[];
  deliverables: QuestDeliverableRecord[];
  health: {
    state: QuestHealthState;
    marker: number;
    summary: string;
    updatesThisWeek: number;
    lastUpdateAt: string | null;
    daysToTarget: number | null;
  };
  proposalDocumentId: number | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuestListingCounts = Record<QuestStatus, number>;

export type QuestListing = {
  /** Stored statuses over the quests of the space (narrowed by `mineOfPersonId` only). */
  counts: QuestListingCounts;
  /** The quests that match the filters, before paging. */
  total: number;
  items: QuestListingRecord[];
};

const toIso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function daysToTarget(targetDate: string | null, now: Date): number | null {
  const parsed = parseQuestCalendarDate(targetDate);
  if (!parsed) return null;
  const target = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((target - today) / 86_400_000);
}

function buildHealth(
  row: SpaceQuest,
  status: QuestStatus,
  milestones: QuestMilestoneRecord[],
  updates: { week: number; lastAt: string | null },
  now: Date,
): QuestListingRecord['health'] {
  const computed =
    status === 'active'
      ? computeQuestHealth(
          { status, targetDate: row.targetDate, milestones },
          now,
        )
      : null;
  const state: QuestHealthState = computed
    ? computed.state
    : isQuestHealthState(row.healthState)
    ? row.healthState
    : 'on_track';
  const stored =
    typeof row.healthMarker === 'number' && Number.isFinite(row.healthMarker)
      ? Math.max(0, Math.min(100, row.healthMarker))
      : state === 'on_track'
      ? 80
      : state === 'at_risk'
      ? 48
      : 18;
  return {
    state,
    // a completed quest sits at the healthy end, as in the app
    marker: computed ? computed.marker : status === 'completed' ? 100 : stored,
    // a computed health has no stored summary
    summary: computed ? '' : row.healthSummary?.trim() ?? '',
    updatesThisWeek: updates.week,
    lastUpdateAt: updates.lastAt,
    daysToTarget: daysToTarget(row.targetDate, now),
  };
}

export async function readQuestsListing(
  { db }: DbConfig,
  filter: QuestListingFilter,
): Promise<QuestListing> {
  const now = new Date();
  const scope: SQL[] = [eq(spaceQuests.spaceId, filter.spaceId)];
  if (filter.mineOfPersonId !== undefined) {
    const person = filter.mineOfPersonId;
    scope.push(
      sql`(${spaceQuests.leadPersonId} = ${person} or exists (
        select 1 from ${spaceQuestMembers}
        where ${spaceQuestMembers.questId} = ${spaceQuests.id}
          and ${spaceQuestMembers.personId} = ${person}
      ))`,
    );
  }

  const countRows = await db
    .select({ status: spaceQuests.status, n: sql<number>`count(*)::int` })
    .from(spaceQuests)
    .where(and(...scope))
    .groupBy(spaceQuests.status);
  const counts: QuestListingCounts = {
    active: 0,
    proposed: 0,
    paused: 0,
    completed: 0,
    archived: 0,
  };
  for (const row of countRows) {
    const status: QuestStatus = isQuestStatus(row.status)
      ? row.status
      : 'active';
    counts[status] += Number(row.n);
  }

  const matching: SQL[] = [...scope];
  let total: number;
  if (filter.status) {
    matching.push(eq(spaceQuests.status, filter.status));
    total = counts[filter.status];
  } else if (filter.includeArchived) {
    total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  } else {
    matching.push(ne(spaceQuests.status, 'archived'));
    total =
      Object.values(counts).reduce((sum, n) => sum + n, 0) - counts.archived;
  }

  const rows = await db
    .select()
    .from(spaceQuests)
    .where(and(...matching))
    .orderBy(
      sql`coalesce((select max(${spaceQuestUpdates.createdAt}) from ${spaceQuestUpdates}
        where ${spaceQuestUpdates.questId} = ${spaceQuests.id}), ${spaceQuests.updatedAt}) desc`,
      desc(spaceQuests.id),
    )
    .limit(filter.limit)
    .offset(filter.offset);
  if (rows.length === 0) return { counts, total, items: [] };

  const ids = rows.map((row) => row.id);
  const [milestoneRows, memberRows, deliverableRows, updateRows] =
    await Promise.all([
      db
        .select()
        .from(spaceQuestMilestones)
        .where(inArray(spaceQuestMilestones.questId, ids))
        .orderBy(asc(spaceQuestMilestones.order), asc(spaceQuestMilestones.id)),
      db
        .select()
        .from(spaceQuestMembers)
        .where(inArray(spaceQuestMembers.questId, ids))
        .orderBy(asc(spaceQuestMembers.order), asc(spaceQuestMembers.id)),
      db
        .select()
        .from(spaceQuestDeliverables)
        .where(inArray(spaceQuestDeliverables.questId, ids))
        .orderBy(
          asc(spaceQuestDeliverables.order),
          asc(spaceQuestDeliverables.id),
        ),
      db
        .select({
          questId: spaceQuestUpdates.questId,
          week: sql<number>`(count(*) filter (where ${spaceQuestUpdates.createdAt} >= (now() at time zone 'utc') - interval '7 days'))::int`,
          lastAt: sql<
            string | null
          >`to_char(max(${spaceQuestUpdates.createdAt}), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
        })
        .from(spaceQuestUpdates)
        .where(inArray(spaceQuestUpdates.questId, ids))
        .groupBy(spaceQuestUpdates.questId),
    ]);

  const updatesByQuest = new Map(
    updateRows.map((row) => [
      row.questId,
      { week: Number(row.week), lastAt: row.lastAt },
    ]),
  );
  const group = <T extends { questId: number }>(list: T[]) => {
    const map = new Map<number, T[]>();
    for (const item of list) {
      const bucket = map.get(item.questId) ?? [];
      bucket.push(item);
      map.set(item.questId, bucket);
    }
    return map;
  };
  const milestonesBy = group(milestoneRows);
  const membersBy = group(memberRows);
  const deliverablesBy = group(deliverableRows);

  const items = rows.map((row): QuestListingRecord => {
    const status: QuestStatus = isQuestStatus(row.status)
      ? row.status
      : 'active';
    const leadName = stripViewerYouMarker(row.leadName ?? '').trim();
    const milestones: QuestMilestoneRecord[] = (
      milestonesBy.get(row.id) ?? []
    ).map((m) => ({
      id: m.id,
      questId: m.questId,
      order: m.order,
      name: m.name,
      description: m.description ?? '',
      dueDate: m.dueDate ?? null,
      ownerPersonId: m.ownerPersonId ?? null,
      ownerName: m.ownerName ?? null,
      status: isQuestMilestoneStatus(m.status) ? m.status : 'not_started',
    }));
    const cleanLead = leadName.toLowerCase();
    const members = withoutPlaceholderLeadDuplicates(
      (membersBy.get(row.id) ?? []).map(
        (m): QuestMemberRecord => ({
          id: m.id,
          questId: m.questId,
          personId: m.personId ?? null,
          memberName: m.memberName,
          // never part of the answer
          memberAvatarUrl: null,
          roleLabel: m.roleLabel ?? null,
          responsibilities: Array.isArray(m.responsibilities)
            ? m.responsibilities
            : [],
          order: m.order,
          isLead:
            (row.leadPersonId != null && m.personId === row.leadPersonId) ||
            m.roleLabel?.toLowerCase() === 'lead' ||
            Boolean(
              cleanLead &&
                stripViewerYouMarker(m.memberName).trim().toLowerCase() ===
                  cleanLead,
            ),
        }),
      ),
    );
    const scopeIn = Array.isArray(row.scopeIn) ? row.scopeIn : [];
    const scopeOut = Array.isArray(row.scopeOut) ? row.scopeOut : [];
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      status,
      goal: row.goal ?? '',
      scopeInMarkdown:
        row.scopeInMarkdown?.trim() || bulletsToMarkdownList(scopeIn),
      scopeOutMarkdown:
        row.scopeOutMarkdown?.trim() || bulletsToMarkdownList(scopeOut),
      successCriteria: row.successCriteria ?? '',
      rewards: Array.isArray(row.rewards) ? row.rewards : [],
      targetDate: row.targetDate ?? null,
      leadPersonId: row.leadPersonId ?? null,
      leadName,
      members,
      milestones,
      deliverables: (deliverablesBy.get(row.id) ?? []).map((d) => ({
        id: d.id,
        questId: d.questId,
        name: d.name,
        url: d.url ?? null,
        note: d.note ?? null,
        order: d.order,
        updatedByPersonId: null,
        updatedByName: null,
        updatedAt: toIso(d.updatedAt) ?? '',
      })),
      health: buildHealth(
        row,
        status,
        milestones,
        updatesByQuest.get(row.id) ?? { week: 0, lastAt: null },
        now,
      ),
      proposalDocumentId: row.proposalDocumentId ?? null,
      acceptedAt: toIso(row.acceptedAt),
      createdAt: toIso(row.createdAt) ?? '',
      updatedAt: toIso(row.updatedAt) ?? '',
    };
  });

  return { counts, total, items };
}
