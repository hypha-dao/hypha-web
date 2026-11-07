import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  documents,
  matrixUserLinks,
  memberships,
  people,
  spaceQuestDeliverables,
  spaceQuestMembers,
  spaceQuestMilestones,
  spaceQuests,
  spaceQuestUpdates,
  type QuestUpdateChangePayload,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import {
  attachProposalStatusToDocument,
  fetchProposalOutcomeSetsForSpace,
} from '../../governance/server/resolve-document-proposal-status';
import type { Document } from '../../governance/types';
import { computeSpaceMemberEntries } from '../../space/server/get-space-members-roster';
import { findSpaceBySlug } from '../../space/server/queries';
import {
  getMatrixBotAsToken,
  getMatrixHomeserverUrl,
  matrixCreateRoom,
  matrixInviteUser,
  matrixKickUser,
  matrixSendTextMessage,
} from '../../matrix/server/matrix-http-client';
import { HYPHA_ROOM_TYPES } from '../../matrix/room-types';
import { QUEST_DOCUMENT_LABEL, type QuestStatus } from '../constants';
import {
  bulletsToMarkdownList,
  canMemberEditQuest,
  embeddedQuestProposalMatchesQuest,
  isViewerQuestLead,
  parseQuestProposalFromDescription,
  slugifyQuestName,
  splitMarkdownLinesToBullets,
  withoutPlaceholderLeadDuplicates,
} from '../markdown';
import { offRosterQuestPersonIds } from '../roster';
import type { QuestRecord } from '../types';
import type {
  schemaCreateSpaceQuest,
  schemaPatchSpaceQuest,
  schemaPostQuestUpdate,
} from '../validation';
import type { z } from 'zod';
import { getSpaceQuestBySlug } from './queries';

export type SpaceQuestWriteError =
  | 'not_found'
  | 'forbidden'
  | 'lead_only'
  | 'archived'
  | 'delete_blocked_ratified'
  | 'not_active'
  | 'invalid_input';

export type SpaceQuestWriteResult =
  | { ok: true; quest: QuestRecord }
  | { ok: false; error: SpaceQuestWriteError };

async function resolveUniqueQuestSlug(
  spaceId: number,
  name: string,
  db: DbConfig['db'],
): Promise<string> {
  const base = slugifyQuestName(name);
  const existing = await db
    .select({ slug: spaceQuests.slug })
    .from(spaceQuests)
    .where(eq(spaceQuests.spaceId, spaceId));
  // `new` is the create-draft route segment under /quests.
  const taken = new Set(['new', ...existing.map((r) => r.slug.toLowerCase())]);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

async function matrixUserIdsForPeople(
  personIds: Array<number | null | undefined>,
  db: DbConfig['db'],
): Promise<Set<string>> {
  const ids = [
    ...new Set(
      personIds.filter((id): id is number => typeof id === 'number' && id > 0),
    ),
  ];
  if (ids.length === 0) return new Set();
  const personRows = await db
    .select({ sub: people.sub })
    .from(people)
    .where(inArray(people.id, ids));
  const subs = personRows
    .map((p) => p.sub?.trim())
    .filter((s): s is string => Boolean(s));
  if (subs.length === 0) return new Set();
  const links = await db
    .select({ matrixUserId: matrixUserLinks.matrixUserId })
    .from(matrixUserLinks)
    .where(inArray(matrixUserLinks.privyUserId, subs));
  return new Set(
    links
      .map((link) => link.matrixUserId?.trim())
      .filter((mxid): mxid is string => Boolean(mxid)),
  );
}

/** Invite added and remove dropped Quest people from the Quest channel. */
async function reconcileQuestChannelMembers({
  roomId,
  beforePersonIds,
  afterPersonIds,
  db,
}: {
  roomId: string;
  beforePersonIds: Array<number | null | undefined>;
  afterPersonIds: Array<number | null | undefined>;
  db: DbConfig['db'];
}): Promise<void> {
  const homeserver = getMatrixHomeserverUrl();
  const botToken = getMatrixBotAsToken();
  if (!homeserver || !botToken) return;
  try {
    const [before, after] = await Promise.all([
      matrixUserIdsForPeople(beforePersonIds, db),
      matrixUserIdsForPeople(afterPersonIds, db),
    ]);
    for (const mxid of after) {
      if (before.has(mxid)) continue;
      await matrixInviteUser(roomId, mxid, botToken, homeserver).catch(
        () => undefined,
      );
    }
    for (const mxid of before) {
      if (after.has(mxid)) continue;
      await matrixKickUser(roomId, mxid, botToken, homeserver).catch(
        () => undefined,
      );
    }
  } catch (error) {
    console.warn(
      '[space-quests] Matrix quest channel membership sync skipped:',
      error instanceof Error ? error.message : error,
    );
  }
}

const QUEST_ROOM_CLAIM_PREFIX = 'provisioning:';
const QUEST_ROOM_CLAIM_TTL_MS = 60_000;

function isExpiredQuestRoomClaim(value: string | null | undefined): boolean {
  if (!value || !value.startsWith(QUEST_ROOM_CLAIM_PREFIX)) return false;
  const parts = value.split(':');
  const ts = Number(parts[1]);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > QUEST_ROOM_CLAIM_TTL_MS;
}

/**
 * Provision a Matrix quest channel (`kind: quest`) when a Quest proposal is accepted.
 * Only Quest members (lead + members) are invited/notified on creation; the room
 * itself is listed under Messages -> Spaces -> Quests for space members.
 */
async function provisionQuestChannelOnAccept({
  questId,
  currentChatRoomId,
  questName,
  leadPersonId,
  leadName,
  memberPersonIds,
  memberNames,
  db,
}: {
  questId: number;
  currentChatRoomId?: string | null;
  questName: string;
  leadPersonId: number | null;
  leadName: string;
  memberPersonIds: number[];
  memberNames: string[];
  db: DbConfig['db'];
}): Promise<string | null> {
  const homeserver = getMatrixHomeserverUrl();
  const botToken = getMatrixBotAsToken();
  if (!homeserver || !botToken) return null;

  if (currentChatRoomId && !isExpiredQuestRoomClaim(currentChatRoomId)) {
    return null;
  }

  const claimToken = `${QUEST_ROOM_CLAIM_PREFIX}${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const claimed = await db
    .update(spaceQuests)
    .set({ chatRoomId: claimToken })
    .where(
      and(
        eq(spaceQuests.id, questId),
        currentChatRoomId
          ? eq(spaceQuests.chatRoomId, currentChatRoomId)
          : isNull(spaceQuests.chatRoomId),
      ),
    )
    .returning();
  if (claimed.length === 0) return null;

  try {
    const roomId = await matrixCreateRoom(
      questName,
      botToken,
      homeserver,
      HYPHA_ROOM_TYPES.quest,
    );

    const stored = await db
      .update(spaceQuests)
      .set({ chatRoomId: roomId })
      .where(
        and(
          eq(spaceQuests.id, questId),
          eq(spaceQuests.chatRoomId, claimToken),
        ),
      )
      .returning();
    if (stored.length === 0) {
      console.warn(
        '[space-quests] Quest room claim was lost; orphaned room:',
        roomId,
      );
      return null;
    }

    // Notify ONLY Quest members (Lead + QuestMembers) by inviting only their Matrix accounts
    const mxids = await matrixUserIdsForPeople(
      [leadPersonId, ...memberPersonIds],
      db,
    );
    for (const mxid of mxids) {
      await matrixInviteUser(roomId, mxid, botToken, homeserver).catch(
        () => undefined,
      );
    }

    const acceptedDate = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const rosterLine = [leadName, ...memberNames.filter((n) => n !== leadName)]
      .filter(Boolean)
      .join(', ');

    await matrixSendTextMessage(
      roomId,
      `Quest accepted · ${acceptedDate} — channel opened${
        rosterLine ? `\nMembers: ${rosterLine}` : ''
      }`,
      botToken,
      homeserver,
    ).catch(() => undefined);

    return roomId;
  } catch (error) {
    try {
      await db
        .update(spaceQuests)
        .set({ chatRoomId: null })
        .where(
          and(
            eq(spaceQuests.id, questId),
            eq(spaceQuests.chatRoomId, claimToken),
          ),
        );
    } catch {
      // Best-effort release; TTL expires stale claims otherwise.
    }
    console.warn(
      '[space-quests] Matrix quest channel provisioning skipped:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function createSpaceQuest(
  {
    spaceSlug,
    input,
    actor,
  }: {
    spaceSlug: string;
    input: z.infer<typeof schemaCreateSpaceQuest>;
    actor?: {
      id?: number | null;
      name?: string | null;
      avatarUrl?: string | null;
    } | null;
  },
  { db }: DbConfig,
): Promise<SpaceQuestWriteResult> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) return { ok: false, error: 'not_found' };

  const slug = await resolveUniqueQuestSlug(space.id, input.name, db);
  const scopeIn =
    input.scopeIn.length > 0
      ? input.scopeIn
      : splitMarkdownLinesToBullets(input.scopeInMarkdown ?? '');
  const scopeOut =
    input.scopeOut.length > 0
      ? input.scopeOut
      : splitMarkdownLinesToBullets(input.scopeOutMarkdown ?? '');
  const scopeInMarkdown =
    input.scopeInMarkdown?.trim() || bulletsToMarkdownList(scopeIn);
  const scopeOutMarkdown =
    input.scopeOutMarkdown?.trim() || bulletsToMarkdownList(scopeOut);

  const actorName = actor?.name?.trim() || 'Space Member';
  const leadName = input.leadName?.trim() || actorName;
  const leadPersonId =
    input.leadPersonId ?? (leadName === actorName ? actor?.id ?? null : null);
  if (leadPersonId == null) {
    return { ok: false, error: 'invalid_input' };
  }

  const rosterError = await assertPersonIdsAreSpaceMembers({
    spaceSlug,
    spaceId: space.id,
    personIds: [
      leadPersonId,
      ...input.members.map((member) => member.personId),
    ],
    actorId: actor?.id ?? null,
    db,
  });
  if (rosterError) return { ok: false, error: rosterError };

  const [created] = await db
    .insert(spaceQuests)
    .values({
      spaceId: space.id,
      slug,
      name: input.name.trim(),
      goal: input.goal.trim(),
      scopeIn,
      scopeOut,
      scopeInMarkdown,
      scopeOutMarkdown,
      successCriteria: input.successCriteria.trim(),
      rewards: input.rewards.filter(
        (r) => r.amount.trim().length > 0 && r.token.trim().length > 0,
      ),
      status: 'proposed',
      targetDate: input.targetDate?.trim() || null,
      leadPersonId,
      leadName,
      creatorPersonId: actor?.id ?? null,
      proposalDocumentId: null,
      healthState: 'on_track',
      healthMarker: 82,
      healthSummary: 'Quest proposal submitted for voting.',
      healthUpdatedAt: new Date(),
    })
    .returning();

  if (!created) return { ok: false, error: 'invalid_input' };

  if (input.milestones.length > 0) {
    await db.insert(spaceQuestMilestones).values(
      input.milestones.map((m, idx) => ({
        questId: created.id,
        order: idx + 1,
        name: m.name.trim(),
        description: m.description ?? '',
        dueDate: m.dueDate?.trim() || null,
        ownerPersonId: m.ownerPersonId ?? null,
        ownerName: m.ownerName?.trim() || null,
        status: m.status ?? 'not_started',
      })),
    );
  }

  const membersToInsert = withoutPlaceholderLeadDuplicates(
    input.members.length > 0
      ? input.members
      : [
          {
            personId: leadPersonId,
            memberName: leadName,
            memberAvatarUrl: actor?.avatarUrl ?? null,
            roleLabel: 'Lead',
            responsibilities: [],
          },
        ],
  );

  await db.insert(spaceQuestMembers).values(
    membersToInsert.map((m, idx) => ({
      questId: created.id,
      personId: m.personId ?? null,
      memberName: m.memberName.trim(),
      memberAvatarUrl: m.memberAvatarUrl ?? null,
      roleLabel: m.roleLabel?.trim() || (idx === 0 ? 'Lead' : 'Member'),
      responsibilities: (m.responsibilities ?? [])
        .map((r) => r.trim())
        .filter(Boolean),
      order: idx + 1,
    })),
  );

  await db.insert(spaceQuestUpdates).values({
    questId: created.id,
    authorPersonId: actor?.id ?? null,
    authorName: leadName,
    authorAvatarUrl: actor?.avatarUrl ?? null,
    kind: 'post',
    viaAgent: false,
    milestoneOrder: null,
    milestoneLabel: null,
    text:
      created.status === 'proposed'
        ? 'proposed, waiting for votes'
        : 'created the quest',
    links: [],
  });

  const quest = await getSpaceQuestBySlug(
    { spaceSlug, questSlug: created.slug },
    { db },
  );
  return quest ? { ok: true, quest } : { ok: false, error: 'not_found' };
}

function hasInvalidIds(
  rows: { id?: number }[],
  owned: { id: number }[],
): boolean {
  const available = new Set(owned.map((row) => row.id));
  return rows.some(({ id }) => id !== undefined && !available.delete(id));
}

function uniquePositiveIds(
  personIds: Array<number | null | undefined>,
): number[] {
  return [
    ...new Set(
      personIds.filter((id): id is number => typeof id === 'number' && id > 0),
    ),
  ];
}

/**
 * Members-tab roster check: only space members may be stored as new lead/member
 * person IDs (and later invited to the Quest Matrix room). Already-saved IDs
 * are preserved so an outsider who remains on the quest is not blocked.
 */
async function assertPersonIdsAreSpaceMembers({
  spaceSlug,
  spaceId,
  personIds,
  actorId,
  preservedIds,
  db,
}: {
  spaceSlug: string;
  spaceId: number;
  personIds: Array<number | null | undefined>;
  actorId?: number | null;
  preservedIds?: ReadonlySet<number>;
  db: DbConfig['db'];
}): Promise<SpaceQuestWriteError | null> {
  const preserved = preservedIds ?? new Set<number>();
  if (offRosterQuestPersonIds(personIds, new Set(), preserved).length === 0) {
    return null;
  }

  const rosterIds = new Set<number>();
  if (typeof actorId === 'number' && actorId > 0) {
    rosterIds.add(actorId);
  }

  try {
    const computed = await computeSpaceMemberEntries(spaceSlug, { db });
    if (!computed.found) return 'not_found';
    for (const entry of computed.entries) {
      if (entry.member_kind === 'person') {
        rosterIds.add(entry.person.id);
      }
    }
  } catch (error) {
    console.warn(
      '[space-quests] space roster lookup skipped:',
      error instanceof Error ? error.message : error,
    );
  }

  const membershipRows = await db
    .select({ personId: memberships.personId })
    .from(memberships)
    .where(eq(memberships.spaceId, spaceId));
  for (const row of membershipRows) {
    rosterIds.add(row.personId);
  }

  return offRosterQuestPersonIds(personIds, rosterIds, preserved).length > 0
    ? 'invalid_input'
    : null;
}

export async function updateSpaceQuest(
  {
    spaceSlug,
    questSlug,
    patch,
    actor,
  }: {
    spaceSlug: string;
    questSlug: string;
    patch: z.infer<typeof schemaPatchSpaceQuest>;
    actor: {
      id?: number | null;
      name?: string | null;
      avatarUrl?: string | null;
    };
  },
  { db }: DbConfig,
): Promise<SpaceQuestWriteResult> {
  const current = await getSpaceQuestBySlug({ spaceSlug, questSlug }, { db });
  if (!current) return { ok: false, error: 'not_found' };

  // Link proposalDocumentId right after CREATE QUEST submits the proposal
  if (
    patch.proposalDocumentId != null &&
    Object.keys(patch).every((k) => k === 'proposalDocumentId')
  ) {
    const isCreator = actor.id != null && current.creatorPersonId === actor.id;
    if (!isCreator && !isViewerQuestLead(actor, current)) {
      return { ok: false, error: 'lead_only' };
    }
    if (current.status !== 'proposed') {
      return { ok: false, error: 'invalid_input' };
    }
    if (current.proposalDocumentId != null) {
      return current.proposalDocumentId === patch.proposalDocumentId
        ? { ok: true, quest: current }
        : { ok: false, error: 'invalid_input' };
    }
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, patch.proposalDocumentId))
      .limit(1);
    const [linked] = await db
      .select({ id: spaceQuests.id })
      .from(spaceQuests)
      .where(eq(spaceQuests.proposalDocumentId, patch.proposalDocumentId))
      .limit(1);
    if (
      !doc ||
      doc.spaceId !== current.spaceId ||
      doc.label !== QUEST_DOCUMENT_LABEL ||
      doc.creatorId !== actor.id ||
      linked
    ) {
      return { ok: false, error: 'invalid_input' };
    }
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    const outcomes =
      space?.web3SpaceId != null
        ? await fetchProposalOutcomeSetsForSpace(space.web3SpaceId, {
            blockTag: 'latest',
          })
        : null;
    const withStatus = attachProposalStatusToDocument(
      doc as Document,
      outcomes,
    );
    const parsed = parseQuestProposalFromDescription(doc.description);
    if (
      withStatus.status !== 'onVoting' ||
      !parsed ||
      !embeddedQuestProposalMatchesQuest(parsed, current)
    ) {
      return { ok: false, error: 'invalid_input' };
    }
    await db
      .update(spaceQuests)
      .set({
        proposalDocumentId: patch.proposalDocumentId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(spaceQuests.id, current.id),
          isNull(spaceQuests.proposalDocumentId),
        ),
      );
    const refreshed = await getSpaceQuestBySlug(
      { spaceSlug, questSlug },
      { db },
    );
    return refreshed
      ? { ok: true, quest: refreshed }
      : { ok: false, error: 'not_found' };
  }

  if (
    current.status === 'archived' &&
    (patch.status === undefined || patch.status === current.status)
  ) {
    return { ok: false, error: 'archived' };
  }
  // Create is the only path to proposed; never demote an accepted quest.
  if ((patch.status as QuestStatus | undefined) === 'proposed') {
    return { ok: false, error: 'invalid_input' };
  }
  // Voters approve the proposed terms; edits and activation wait for the vote.
  if (current.status === 'proposed') {
    return { ok: false, error: 'not_active' };
  }

  // Permission enforcement (SPEC §5):
  // - Lead-only: status change, lead transfer
  // - Any Quest member: content edits (name, goal, scope, success, milestones, members, deliverables, targetDate, rewards)
  const isMember = canMemberEditQuest(actor, current);
  const isLead = isViewerQuestLead(actor, current);

  const isLeadOnlyChange =
    (patch.status !== undefined && patch.status !== current.status) ||
    (patch.leadName !== undefined &&
      patch.leadName.trim() !== current.leadName.trim()) ||
    (patch.leadPersonId !== undefined &&
      patch.leadPersonId !== current.leadPersonId);

  if (isLeadOnlyChange && !isLead) {
    return { ok: false, error: 'lead_only' };
  }
  if (!isMember && !isLead) {
    return { ok: false, error: 'forbidden' };
  }

  const preservedIds = new Set(
    uniquePositiveIds([
      current.leadPersonId,
      ...current.members.map((member) => member.personId),
    ]),
  );
  const rosterError = await assertPersonIdsAreSpaceMembers({
    spaceSlug,
    spaceId: current.spaceId,
    personIds: [
      patch.leadPersonId,
      ...(patch.members ?? []).map((member) => member.personId),
    ],
    actorId: actor.id ?? null,
    preservedIds,
    db,
  });
  if (rosterError) return { ok: false, error: rosterError };

  const now = new Date();
  const actorName = actor.name?.trim() || current.leadName || 'Quest Member';
  const editEvents: Array<{
    text: string;
    change: QuestUpdateChangePayload;
  }> = [];

  const updateFields: Record<string, unknown> = {
    updatedAt: now,
  };

  if (patch.name !== undefined && patch.name.trim() !== current.name) {
    updateFields.name = patch.name.trim();
    editEvents.push({
      text: `Updated quest name to “${patch.name.trim()}”.`,
      change: {
        entity: 'quest',
        field: 'name',
        action: 'updated',
        before: current.name,
        after: patch.name.trim(),
      },
    });
  }

  if (patch.goal !== undefined && patch.goal.trim() !== current.goal.trim()) {
    updateFields.goal = patch.goal.trim();
    editEvents.push({
      text: 'Updated Goal.',
      change: {
        entity: 'quest',
        field: 'goal',
        action: 'updated',
        before: current.goal,
        after: patch.goal.trim(),
      },
    });
  }

  if (
    patch.scopeIn !== undefined ||
    patch.scopeOut !== undefined ||
    patch.scopeInMarkdown !== undefined ||
    patch.scopeOutMarkdown !== undefined
  ) {
    const nextScopeIn =
      patch.scopeIn ??
      (patch.scopeInMarkdown !== undefined
        ? splitMarkdownLinesToBullets(patch.scopeInMarkdown)
        : current.scopeIn);
    const nextScopeOut =
      patch.scopeOut ??
      (patch.scopeOutMarkdown !== undefined
        ? splitMarkdownLinesToBullets(patch.scopeOutMarkdown)
        : current.scopeOut);
    updateFields.scopeIn = nextScopeIn;
    updateFields.scopeOut = nextScopeOut;
    updateFields.scopeInMarkdown =
      patch.scopeInMarkdown?.trim() ?? bulletsToMarkdownList(nextScopeIn);
    updateFields.scopeOutMarkdown =
      patch.scopeOutMarkdown?.trim() ?? bulletsToMarkdownList(nextScopeOut);
    editEvents.push({
      text: 'Updated Scope.',
      change: {
        entity: 'quest',
        field: 'scope',
        action: 'updated',
      },
    });
  }

  if (
    patch.successCriteria !== undefined &&
    patch.successCriteria.trim() !== current.successCriteria.trim()
  ) {
    updateFields.successCriteria = patch.successCriteria.trim();
    editEvents.push({
      text: 'Updated Success criteria.',
      change: {
        entity: 'quest',
        field: 'successCriteria',
        action: 'updated',
      },
    });
  }

  if (patch.rewards !== undefined) {
    const cleaned = patch.rewards.filter(
      (r) => r.amount.trim().length > 0 && r.token.trim().length > 0,
    );
    updateFields.rewards = cleaned;
    editEvents.push({
      text: `Updated Quest Reward (${
        cleaned.map((r) => `${r.amount} ${r.token}`).join(', ') || 'none'
      }).`,
      change: {
        entity: 'quest',
        field: 'rewards',
        action: 'updated',
      },
    });
  }

  if (
    patch.targetDate !== undefined &&
    (patch.targetDate ?? null) !== current.targetDate
  ) {
    updateFields.targetDate = patch.targetDate?.trim() || null;
    editEvents.push({
      text: `Updated Target date to ${patch.targetDate?.trim() || '—'}.`,
      change: {
        entity: 'quest',
        field: 'targetDate',
        action: 'updated',
        before: current.targetDate,
        after: patch.targetDate?.trim() || null,
      },
    });
  }

  const leadNameChanged =
    patch.leadName !== undefined &&
    patch.leadName.trim() !== current.leadName.trim();
  if (
    patch.leadPersonId === null ||
    (leadNameChanged && patch.leadPersonId == null)
  ) {
    return { ok: false, error: 'invalid_input' };
  }

  if (leadNameChanged) {
    updateFields.leadName = patch.leadName!.trim();
    editEvents.push({
      text: `Transferred Quest Lead to ${patch.leadName!.trim()}.`,
      change: {
        entity: 'quest',
        field: 'lead',
        action: 'updated',
        before: current.leadName,
        after: patch.leadName!.trim(),
      },
    });
  }

  if (
    patch.leadPersonId != null &&
    patch.leadPersonId !== current.leadPersonId
  ) {
    updateFields.leadPersonId = patch.leadPersonId;
  }

  if (patch.status !== undefined && patch.status !== current.status) {
    updateFields.status = patch.status;
    if (patch.status === 'active' && !current.acceptedAt) {
      updateFields.acceptedAt = now;
    }
    editEvents.push({
      text: `Changed Quest status from ${current.status} to ${patch.status}.`,
      change: {
        entity: 'quest',
        field: 'status',
        action: 'updated',
        before: current.status,
        after: patch.status,
      },
    });
  }

  if (patch.stewardHealthSummaries !== undefined) {
    updateFields.stewardHealthSummaries = patch.stewardHealthSummaries;
  }
  if (patch.memberUpdateAlerts !== undefined) {
    updateFields.memberUpdateAlerts = patch.memberUpdateAlerts;
  }
  if (patch.healthState !== undefined) {
    updateFields.healthState = patch.healthState;
    updateFields.healthUpdatedAt = now;
  }
  if (patch.healthMarker !== undefined) {
    updateFields.healthMarker = patch.healthMarker;
    updateFields.healthUpdatedAt = now;
  }
  if (patch.healthSummary !== undefined) {
    updateFields.healthSummary = patch.healthSummary;
    updateFields.healthUpdatedAt = now;
  }

  let writeError: SpaceQuestWriteError | null = null;
  await db.transaction(async (tx) => {
    await tx
      .select({ id: spaceQuests.id })
      .from(spaceQuests)
      .where(eq(spaceQuests.id, current.id))
      .limit(1)
      .for('update');

    if (patch.milestones !== undefined) {
      const ownedMilestones = await tx
        .select({ id: spaceQuestMilestones.id })
        .from(spaceQuestMilestones)
        .where(eq(spaceQuestMilestones.questId, current.id));
      if (hasInvalidIds(patch.milestones, ownedMilestones)) {
        writeError = 'invalid_input';
        return;
      }
    }
    if (patch.members !== undefined) {
      const ownedMembers = await tx
        .select({ id: spaceQuestMembers.id })
        .from(spaceQuestMembers)
        .where(eq(spaceQuestMembers.questId, current.id));
      if (hasInvalidIds(patch.members, ownedMembers)) {
        writeError = 'invalid_input';
        return;
      }
    }

    await tx
      .update(spaceQuests)
      .set(updateFields)
      .where(eq(spaceQuests.id, current.id));

    if (patch.milestones !== undefined) {
      await tx
        .delete(spaceQuestMilestones)
        .where(eq(spaceQuestMilestones.questId, current.id));
      if (patch.milestones.length > 0) {
        await tx.insert(spaceQuestMilestones).values(
          patch.milestones.map((m, idx) => ({
            ...(typeof m.id === 'number' ? { id: m.id } : {}),
            questId: current.id,
            order: idx + 1,
            name: m.name.trim(),
            description: m.description ?? '',
            dueDate: m.dueDate?.trim() || null,
            ownerPersonId: m.ownerPersonId ?? null,
            ownerName: m.ownerName?.trim() || null,
            status: m.status ?? 'not_started',
          })),
        );
      }
      editEvents.push({
        text: `Updated Milestones (${patch.milestones.length} milestone${
          patch.milestones.length === 1 ? '' : 's'
        }).`,
        change: {
          entity: 'milestone',
          field: 'milestones',
          action: 'updated',
        },
      });
    }

    if (patch.members !== undefined) {
      await tx
        .delete(spaceQuestMembers)
        .where(eq(spaceQuestMembers.questId, current.id));
      if (patch.members.length > 0) {
        await tx.insert(spaceQuestMembers).values(
          patch.members.map((m, idx) => ({
            ...(typeof m.id === 'number' ? { id: m.id } : {}),
            questId: current.id,
            personId: m.personId ?? null,
            memberName: m.memberName.trim(),
            memberAvatarUrl: m.memberAvatarUrl ?? null,
            roleLabel: m.roleLabel?.trim() || null,
            responsibilities: (m.responsibilities ?? [])
              .map((r) => r.trim())
              .filter(Boolean),
            order: idx + 1,
          })),
        );
      }
      editEvents.push({
        text: `Updated Members (${patch.members.length} member${
          patch.members.length === 1 ? '' : 's'
        }).`,
        change: {
          entity: 'member',
          field: 'members',
          action: 'updated',
        },
      });
    }

    if (patch.deliverables !== undefined) {
      await tx
        .delete(spaceQuestDeliverables)
        .where(eq(spaceQuestDeliverables.questId, current.id));
      if (patch.deliverables.length > 0) {
        await tx.insert(spaceQuestDeliverables).values(
          patch.deliverables.map((dItem, idx) => ({
            questId: current.id,
            order: idx + 1,
            name: dItem.name.trim(),
            url: dItem.url?.trim() || null,
            note: dItem.note?.trim() || null,
            updatedByPersonId: actor.id ?? null,
            updatedByName: actorName,
          })),
        );
      }
      editEvents.push({
        text: `Updated Deliverables (${patch.deliverables.length} item${
          patch.deliverables.length === 1 ? '' : 's'
        }).`,
        change: {
          entity: 'deliverable',
          field: 'deliverables',
          action: 'updated',
        },
      });
    }

    // Every post-pass edit writes an edit_event to Updates (who changed what)
    if (editEvents.length > 0) {
      await tx.insert(spaceQuestUpdates).values(
        editEvents.map((ev) => ({
          questId: current.id,
          authorPersonId: actor.id ?? null,
          authorName: actorName,
          authorAvatarUrl: actor.avatarUrl ?? null,
          kind: 'edit_event',
          viaAgent: false,
          milestoneOrder: null,
          milestoneLabel: null,
          text: ev.text,
          links: [],
          change: ev.change,
        })),
      );
    }
  });

  if (writeError) {
    return { ok: false, error: writeError };
  }

  const leadChanged = updateFields.leadPersonId !== undefined;
  if (current.chatRoomId && (patch.members !== undefined || leadChanged)) {
    await reconcileQuestChannelMembers({
      roomId: current.chatRoomId,
      beforePersonIds: [
        current.leadPersonId,
        ...current.members.map((m) => m.personId),
      ],
      afterPersonIds: [
        leadChanged
          ? (updateFields.leadPersonId as number | null)
          : current.leadPersonId,
        ...(patch.members ?? current.members).map((m) => m.personId),
      ],
      db,
    });
  }

  const updated = await getSpaceQuestBySlug({ spaceSlug, questSlug }, { db });
  return updated
    ? { ok: true, quest: updated }
    : { ok: false, error: 'not_found' };
}

export async function postSpaceQuestUpdate(
  {
    spaceSlug,
    questSlug,
    input,
    actor,
  }: {
    spaceSlug: string;
    questSlug: string;
    input: z.infer<typeof schemaPostQuestUpdate>;
    actor: {
      id?: number | null;
      name?: string | null;
      avatarUrl?: string | null;
    };
  },
  { db }: DbConfig,
): Promise<SpaceQuestWriteResult> {
  const current = await getSpaceQuestBySlug({ spaceSlug, questSlug }, { db });
  if (!current) return { ok: false, error: 'not_found' };
  if (current.status === 'archived') {
    return { ok: false, error: 'archived' };
  }
  if (current.status !== 'active' && current.status !== 'paused') {
    return { ok: false, error: 'not_active' };
  }
  if (!canMemberEditQuest(actor, current)) {
    return { ok: false, error: 'forbidden' };
  }

  const actorName = actor.name?.trim() || current.leadName || 'Quest Member';
  const milestoneLabel =
    input.milestoneLabel?.trim() ||
    (input.milestoneOrder ? `M${input.milestoneOrder}` : null);

  await db.insert(spaceQuestUpdates).values({
    questId: current.id,
    authorPersonId: actor.id ?? null,
    authorName: actorName,
    authorAvatarUrl: actor.avatarUrl ?? null,
    kind: 'post',
    viaAgent: false,
    milestoneOrder: input.milestoneOrder ?? null,
    milestoneLabel,
    text: input.text.trim(),
    links: input.links ?? [],
  });

  await db
    .update(spaceQuests)
    .set({ updatedAt: new Date(), healthUpdatedAt: new Date() })
    .where(eq(spaceQuests.id, current.id));

  const updated = await getSpaceQuestBySlug({ spaceSlug, questSlug }, { db });
  return updated
    ? { ok: true, quest: updated }
    : { ok: false, error: 'not_found' };
}

export async function deleteSpaceQuest(
  {
    spaceSlug,
    questSlug,
    actor,
  }: {
    spaceSlug: string;
    questSlug: string;
    actor: { id?: number | null; name?: string | null };
  },
  { db }: DbConfig,
): Promise<{ ok: true } | { ok: false; error: SpaceQuestWriteError }> {
  const current = await getSpaceQuestBySlug({ spaceSlug, questSlug }, { db });
  if (!current) return { ok: false, error: 'not_found' };

  const isCreator = actor.id != null && current.creatorPersonId === actor.id;
  if (
    !isViewerQuestLead(actor, current) &&
    !(current.status === 'proposed' && isCreator)
  ) {
    return { ok: false, error: 'lead_only' };
  }

  if (current.acceptedAt != null || current.proposalStatus === 'accepted') {
    return { ok: false, error: 'delete_blocked_ratified' };
  }

  await db.delete(spaceQuests).where(eq(spaceQuests.id, current.id));
  return { ok: true };
}

/**
 * Activate a Quest when its Agreements proposal passes.
 * Also provisions the Quest channel (`kind: quest`) in Matrix and invites
 * ONLY the Quest members (so only Quest members receive the new-channel notification).
 */
export async function activateSpaceQuestByDocumentId(
  {
    documentId,
    web3ProposalId,
  }: { documentId?: number; web3ProposalId?: number },
  { db }: DbConfig,
): Promise<number> {
  let targetDocId = documentId;
  if (targetDocId == null && web3ProposalId != null) {
    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.web3ProposalId, web3ProposalId))
      .limit(1);
    targetDocId = doc?.id;
  }
  if (targetDocId == null) return 0;

  const matching = await db
    .select()
    .from(spaceQuests)
    .where(eq(spaceQuests.proposalDocumentId, targetDocId));
  if (matching.length === 0) return 0;

  const now = new Date();
  let activatedCount = 0;

  for (const row of matching) {
    if (row.status === 'proposed') {
      const updated = await db
        .update(spaceQuests)
        .set({
          status: 'active',
          acceptedAt: now,
          updatedAt: now,
          healthUpdatedAt: now,
        })
        .where(
          and(eq(spaceQuests.id, row.id), eq(spaceQuests.status, 'proposed')),
        )
        .returning();

      if (updated.length > 0) {
        await db.insert(spaceQuestUpdates).values({
          questId: row.id,
          authorPersonId: row.leadPersonId ?? null,
          authorName: row.leadName || 'Operations Lead',
          kind: 'post',
          viaAgent: false,
          text: 'Quest proposal accepted — Quest is now Active.',
          links: [],
        });

        activatedCount += 1;
      }
    }

    if (
      row.status !== 'archived' &&
      (!row.chatRoomId || isExpiredQuestRoomClaim(row.chatRoomId))
    ) {
      const members = await db
        .select()
        .from(spaceQuestMembers)
        .where(eq(spaceQuestMembers.questId, row.id));
      const roomId = await provisionQuestChannelOnAccept({
        questId: row.id,
        currentChatRoomId: row.chatRoomId,
        questName: row.name,
        leadPersonId: row.leadPersonId ?? null,
        leadName: row.leadName || 'Lead',
        memberPersonIds: members
          .map((m) => m.personId)
          .filter((id): id is number => typeof id === 'number'),
        memberNames: members.map((m) => m.memberName),
        db,
      });
      if (roomId && row.status !== 'proposed') {
        activatedCount += 1;
      }
    }
  }

  return activatedCount;
}
