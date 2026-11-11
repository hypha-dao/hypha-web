import { asc, desc, eq, inArray } from 'drizzle-orm';
import {
  documents,
  people,
  spaceQuestDeliverables,
  spaceQuestMembers,
  spaceQuestMilestones,
  spaceQuests,
  spaceQuestUpdates,
  spaces,
  type SpaceQuest,
  type SpaceQuestDeliverable,
  type SpaceQuestMember,
  type SpaceQuestMilestone,
  type SpaceQuestUpdate,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import { findSpaceBySlug } from '../../space/server/queries';
import {
  isQuestHealthState,
  isQuestMilestoneStatus,
  isQuestStatus,
  type QuestHealthState,
  type QuestStatus,
  type QuestUpdateKind,
} from '../constants';
import {
  bulletsToMarkdownList,
  stripViewerYouMarker,
  withoutPlaceholderLeadDuplicates,
} from '../markdown';
import { parseQuestCalendarDate } from '../calendar-date';
import { computeQuestHealth } from '../health-display';
import { questOverviewCounts } from '../proposal-list-status';
import {
  QUEST_PROPOSAL_ACCEPTED_TEXT,
  questUpdateAuthorForDisplay,
  type QuestAuthorProfile,
  type QuestUpdateAuthorFields,
} from '../quest-update-author';
import type {
  QuestDeliverableRecord,
  QuestHealthSummary,
  QuestMemberRecord,
  QuestMilestoneRecord,
  QuestRecord,
  QuestUpdateRecord,
  SpaceQuestsOverview,
} from '../types';

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function computeDaysToTarget(
  targetDate: string | null | undefined,
): number | null {
  const parsed = parseQuestCalendarDate(targetDate);
  if (!parsed) return null;
  const target = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

function mapMilestoneRow(row: SpaceQuestMilestone): QuestMilestoneRecord {
  return {
    id: row.id,
    questId: row.questId,
    order: row.order,
    name: row.name,
    description: row.description ?? '',
    dueDate: row.dueDate ?? null,
    ownerPersonId: row.ownerPersonId ?? null,
    ownerName: row.ownerName ?? null,
    status: isQuestMilestoneStatus(row.status) ? row.status : 'not_started',
  };
}

function mapMemberRow(
  row: SpaceQuestMember,
  leadPersonId: number | null,
  leadName: string,
): QuestMemberRecord {
  const cleanLead = stripViewerYouMarker(leadName).trim().toLowerCase();
  const cleanMember = stripViewerYouMarker(row.memberName).trim().toLowerCase();
  const isLead =
    (leadPersonId != null && row.personId === leadPersonId) ||
    row.roleLabel?.toLowerCase() === 'lead' ||
    Boolean(cleanLead && cleanMember === cleanLead);

  return {
    id: row.id,
    questId: row.questId,
    personId: row.personId ?? null,
    memberName: row.memberName,
    memberAvatarUrl: row.memberAvatarUrl ?? null,
    roleLabel: row.roleLabel ?? null,
    responsibilities: Array.isArray(row.responsibilities)
      ? row.responsibilities
      : [],
    order: row.order,
    isLead,
  };
}

function mapDeliverableRow(row: SpaceQuestDeliverable): QuestDeliverableRecord {
  return {
    id: row.id,
    questId: row.questId,
    name: row.name,
    url: row.url ?? null,
    note: row.note ?? null,
    order: row.order,
    updatedByPersonId: row.updatedByPersonId ?? null,
    updatedByName: row.updatedByName ?? null,
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function proposalCreatorFor(
  creatorId: number | undefined,
  profiles: ReadonlyMap<number, QuestAuthorProfile>,
): QuestUpdateAuthorFields | null {
  if (creatorId == null) return null;
  const profile = profiles.get(creatorId);
  const name = profile?.name?.trim();
  return {
    authorPersonId: creatorId,
    authorName: name || 'Proposal creator',
    authorAvatarUrl: profile?.avatarUrl ?? null,
  };
}

function mapUpdateRow(row: SpaceQuestUpdate): QuestUpdateRecord {
  const kind: QuestUpdateKind =
    row.kind === 'edit_event' || row.kind === 'agent_post' ? row.kind : 'post';
  return {
    id: row.id,
    questId: row.questId,
    authorPersonId: row.authorPersonId ?? null,
    authorName: row.authorName,
    authorAvatarUrl: row.authorAvatarUrl ?? null,
    kind,
    // Ship without MCP live: keep viaAgent false at ship unless explicitly stored
    viaAgent: false,
    milestoneOrder: row.milestoneOrder ?? null,
    milestoneLabel: row.milestoneLabel ?? null,
    text: row.text,
    links: Array.isArray(row.links) ? row.links : [],
    change: row.change ?? null,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function buildHealthSummary(
  row: SpaceQuest,
  updates: QuestUpdateRecord[],
  milestones: QuestMilestoneRecord[],
): QuestHealthSummary {
  const computed =
    row.status === 'active'
      ? computeQuestHealth(
          {
            status: row.status,
            targetDate: row.targetDate,
            milestones,
          },
          new Date(),
        )
      : null;
  const state: QuestHealthState = computed
    ? computed.state
    : isQuestHealthState(row.healthState)
    ? row.healthState
    : 'on_track';
  const defaultMarker =
    state === 'on_track' ? 80 : state === 'at_risk' ? 48 : 18;
  const marker = computed
    ? computed.marker
    : typeof row.healthMarker === 'number' && Number.isFinite(row.healthMarker)
    ? Math.max(0, Math.min(100, row.healthMarker))
    : defaultMarker;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const updatesThisWeek = updates.filter(
    (u) => new Date(u.createdAt).getTime() >= weekAgo,
  ).length;
  const lastUpdateAt = updates[0]?.createdAt ?? null;
  const doneCount = milestones.filter((m) => m.status === 'done').length;

  const defaultSummary = computed
    ? ''
    : row.healthSummary?.trim() ||
      (updates.length > 0
        ? `${doneCount} of ${
            milestones.length
          } milestones complete. ${updatesThisWeek} update${
            updatesThisWeek === 1 ? '' : 's'
          } posted this week.`
        : 'No updates posted yet. Post progress updates to keep Quest health current.');

  return {
    state,
    marker,
    summary: defaultSummary,
    updatesThisWeek,
    lastUpdateAt,
    generatedAt:
      toIso(row.healthUpdatedAt) ?? lastUpdateAt ?? toIso(row.updatedAt),
    daysToTarget: computeDaysToTarget(row.targetDate),
  };
}

function formatLatestUpdateLine(
  row: SpaceQuest,
  updates: QuestUpdateRecord[],
): string | null {
  const latest = updates[0];
  if (!latest) {
    if (row.status === 'proposed') {
      const leadFirst = (row.leadName || 'Lead').split(' ')[0];
      return `${leadFirst} · just now: proposed, waiting for votes`;
    }
    return null;
  }
  const firstAuthor = latest.authorName.split(' ')[0] || latest.authorName;
  return `${firstAuthor} · ${latest.text}`;
}

type HydratedQuestExtras = {
  spaceSlug: string;
  spaceTitle: string;
  leadAvatarUrl?: string | null;
  proposalSlug?: string | null;
  proposalWeb3Id?: number | null;
  proposalStatus?: 'accepted' | 'rejected' | 'onVoting' | null;
  proposalCreator?: QuestUpdateAuthorFields | null;
  authorProfiles?: ReadonlyMap<number, QuestAuthorProfile>;
  milestones: SpaceQuestMilestone[];
  members: SpaceQuestMember[];
  deliverables: SpaceQuestDeliverable[];
  updates: SpaceQuestUpdate[];
};

export function assembleQuestRecord(
  row: SpaceQuest,
  extras: HydratedQuestExtras,
): QuestRecord {
  const status: QuestStatus = isQuestStatus(row.status) ? row.status : 'active';
  const leadName = row.leadName?.trim() || 'Quest Lead';
  const milestones = [...extras.milestones]
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .map(mapMilestoneRow);
  const members = withoutPlaceholderLeadDuplicates(
    [...extras.members]
      .sort((a, b) => a.order - b.order || a.id - b.id)
      .map((m) => mapMemberRow(m, row.leadPersonId ?? null, leadName)),
  );
  const deliverables = [...extras.deliverables]
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .map(mapDeliverableRow);
  const authorProfiles = extras.authorProfiles ?? new Map();
  const updates = [...extras.updates]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        b.id - a.id,
    )
    .map((row) => {
      const update = mapUpdateRow(row);
      const author = questUpdateAuthorForDisplay(
        update,
        authorProfiles,
        extras.proposalCreator ?? null,
      );
      return { ...update, ...author };
    });

  const scopeIn = Array.isArray(row.scopeIn) ? row.scopeIn : [];
  const scopeOut = Array.isArray(row.scopeOut) ? row.scopeOut : [];
  const scopeInMarkdown =
    row.scopeInMarkdown?.trim() || bulletsToMarkdownList(scopeIn);
  const scopeOutMarkdown =
    row.scopeOutMarkdown?.trim() || bulletsToMarkdownList(scopeOut);
  const health = buildHealthSummary(row, updates, milestones);
  const latestUpdateAt =
    updates[0]?.createdAt ??
    toIso(row.updatedAt) ??
    toIso(row.createdAt) ??
    new Date().toISOString();

  return {
    id: row.id,
    spaceId: row.spaceId,
    spaceSlug: extras.spaceSlug,
    spaceTitle: extras.spaceTitle,
    slug: row.slug,
    name: row.name,
    goal: row.goal ?? '',
    scopeIn,
    scopeOut,
    scopeInMarkdown,
    scopeOutMarkdown,
    successCriteria: row.successCriteria ?? '',
    rewards: Array.isArray(row.rewards) ? row.rewards : [],
    status,
    targetDate: row.targetDate ?? null,
    leadPersonId: row.leadPersonId ?? null,
    leadName,
    leadAvatarUrl: extras.leadAvatarUrl ?? null,
    creatorPersonId: row.creatorPersonId ?? null,
    proposalDocumentId: row.proposalDocumentId ?? null,
    proposalSlug: extras.proposalSlug ?? null,
    proposalWeb3Id: extras.proposalWeb3Id ?? null,
    proposalStatus: extras.proposalStatus ?? null,
    acceptedAt: toIso(row.acceptedAt),
    chatRoomId:
      row.chatRoomId && !row.chatRoomId.startsWith('provisioning:')
        ? row.chatRoomId
        : null,
    health,
    stewardHealthSummaries: row.stewardHealthSummaries ?? true,
    memberUpdateAlerts: row.memberUpdateAlerts ?? true,
    deliverablesEnabled: row.deliverablesEnabled ?? false,
    milestones,
    members,
    deliverables,
    updates,
    latestUpdateLine: formatLatestUpdateLine(row, updates),
    latestUpdateAt,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

export async function listSpaceQuests(
  { spaceSlug }: { spaceSlug: string },
  { db }: DbConfig,
): Promise<SpaceQuestsOverview | null> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) return null;

  const rows = await db
    .select({
      quest: spaceQuests,
      proposalSlug: documents.slug,
      proposalWeb3Id: documents.web3ProposalId,
      proposalCreatorId: documents.creatorId,
      leadAvatarUrl: people.avatarUrl,
    })
    .from(spaceQuests)
    .leftJoin(documents, eq(documents.id, spaceQuests.proposalDocumentId))
    .leftJoin(people, eq(people.id, spaceQuests.leadPersonId))
    .where(eq(spaceQuests.spaceId, space.id))
    .orderBy(desc(spaceQuests.updatedAt));

  const questIds = rows.map((r) => r.quest.id);
  const [milestoneRows, memberRows, deliverableRows, updateRows] =
    questIds.length === 0
      ? [[], [], [], []]
      : await Promise.all([
          db
            .select()
            .from(spaceQuestMilestones)
            .where(inArray(spaceQuestMilestones.questId, questIds))
            .orderBy(asc(spaceQuestMilestones.order)),
          db
            .select()
            .from(spaceQuestMembers)
            .where(inArray(spaceQuestMembers.questId, questIds))
            .orderBy(asc(spaceQuestMembers.order)),
          db
            .select()
            .from(spaceQuestDeliverables)
            .where(inArray(spaceQuestDeliverables.questId, questIds))
            .orderBy(asc(spaceQuestDeliverables.order)),
          db
            .select()
            .from(spaceQuestUpdates)
            .where(inArray(spaceQuestUpdates.questId, questIds))
            .orderBy(desc(spaceQuestUpdates.createdAt)),
        ]);

  const milestonesByQuest = new Map<number, SpaceQuestMilestone[]>();
  for (const row of milestoneRows) {
    const list = milestonesByQuest.get(row.questId) ?? [];
    list.push(row);
    milestonesByQuest.set(row.questId, list);
  }
  const membersByQuest = new Map<number, SpaceQuestMember[]>();
  for (const row of memberRows) {
    const list = membersByQuest.get(row.questId) ?? [];
    list.push(row);
    membersByQuest.set(row.questId, list);
  }
  const deliverablesByQuest = new Map<number, SpaceQuestDeliverable[]>();
  for (const row of deliverableRows) {
    const list = deliverablesByQuest.get(row.questId) ?? [];
    list.push(row);
    deliverablesByQuest.set(row.questId, list);
  }
  const updatesByQuest = new Map<number, SpaceQuestUpdate[]>();
  for (const row of updateRows) {
    const list = updatesByQuest.get(row.questId) ?? [];
    list.push(row);
    updatesByQuest.set(row.questId, list);
  }

  const authorIds = new Set<number>();
  const creatorIdByQuest = new Map<number, number>();
  for (const row of rows) {
    const creatorId = row.proposalCreatorId;
    const questUpdates = updatesByQuest.get(row.quest.id) ?? [];
    if (
      typeof creatorId === 'number' &&
      creatorId > 0 &&
      questUpdates.some(
        (update) =>
          update.text === QUEST_PROPOSAL_ACCEPTED_TEXT &&
          !update.authorAvatarUrl?.trim(),
      )
    ) {
      creatorIdByQuest.set(row.quest.id, creatorId);
      authorIds.add(creatorId);
    }
    for (const update of questUpdates) {
      if (
        !update.authorAvatarUrl?.trim() &&
        typeof update.authorPersonId === 'number' &&
        update.authorPersonId > 0
      ) {
        authorIds.add(update.authorPersonId);
      }
    }
  }
  const authorRows =
    authorIds.size === 0
      ? []
      : await db
          .select({
            id: people.id,
            name: people.name,
            surname: people.surname,
            avatarUrl: people.avatarUrl,
          })
          .from(people)
          .where(inArray(people.id, [...authorIds]));
  const authorProfiles = new Map<number, QuestAuthorProfile>(
    authorRows.map((person) => [
      person.id,
      {
        name: [person.name, person.surname]
          .map((part) => part?.trim())
          .filter((part): part is string => Boolean(part))
          .join(' '),
        avatarUrl: person.avatarUrl,
      },
    ]),
  );

  const quests = rows
    .map((r) =>
      assembleQuestRecord(r.quest, {
        spaceSlug: space.slug,
        spaceTitle: space.title,
        leadAvatarUrl: r.leadAvatarUrl,
        proposalSlug: r.proposalSlug,
        proposalWeb3Id: r.proposalWeb3Id,
        proposalCreator: proposalCreatorFor(
          creatorIdByQuest.get(r.quest.id),
          authorProfiles,
        ),
        authorProfiles,
        milestones: milestonesByQuest.get(r.quest.id) ?? [],
        members: membersByQuest.get(r.quest.id) ?? [],
        deliverables: deliverablesByQuest.get(r.quest.id) ?? [],
        updates: updatesByQuest.get(r.quest.id) ?? [],
      }),
    )
    .sort(
      (a, b) =>
        new Date(b.latestUpdateAt).getTime() -
        new Date(a.latestUpdateAt).getTime(),
    );

  const counts = questOverviewCounts(quests);

  return {
    spaceSlug: space.slug,
    spaceTitle: space.title,
    quests,
    counts,
  };
}

export async function getSpaceQuestBySlug(
  { spaceSlug, questSlug }: { spaceSlug: string; questSlug: string },
  { db }: DbConfig,
): Promise<QuestRecord | null> {
  const overview = await listSpaceQuests({ spaceSlug }, { db });
  if (!overview) return null;
  return overview.quests.find((q) => q.slug === questSlug) ?? null;
}

export async function findSpaceQuestByProposalDocumentId(
  { documentId }: { documentId: number },
  { db }: DbConfig,
): Promise<{ spaceSlug: string; questSlug: string } | null> {
  const [row] = await db
    .select({
      questSlug: spaceQuests.slug,
      spaceId: spaceQuests.spaceId,
    })
    .from(spaceQuests)
    .where(eq(spaceQuests.proposalDocumentId, documentId))
    .limit(1);
  if (!row) return null;

  const [spaceRow] = await db
    .select({ slug: spaces.slug })
    .from(spaces)
    .where(eq(spaces.id, row.spaceId))
    .limit(1);
  if (!spaceRow?.slug) return null;
  return { spaceSlug: spaceRow.slug, questSlug: row.questSlug };
}
