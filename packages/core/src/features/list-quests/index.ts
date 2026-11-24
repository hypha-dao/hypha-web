import 'server-only';

import type { DbConfig } from '../../server';
import { readProposalOutcomeIds } from '../../access/chain-reads';
import type { Caller } from '../../access/caller';
import { failure, type Failure } from '../../access/failure';
import { decideSpaceAccess } from '../../access/policy';
import {
  deriveProposalListStatus,
  type ProposalListStatus,
} from '../../access/proposal-status';
import type {
  QuestHealthState,
  QuestMilestoneStatus,
  QuestStatus,
} from '../../space-quests/constants';
import { stripViewerYouMarker } from '../../space-quests/markdown';
import { selectQuestProposalDocuments } from '../../space-quests/server/list-quests-queries';
import { listSpaceQuests } from '../../space-quests/server/queries';
import type { QuestRecord } from '../../space-quests/types';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';

export type ListQuestsInput = {
  spaceSlug: string;
  /** The stored status. */
  status?: QuestStatus;
  /** Only quests where the caller is the lead or a member. */
  mine?: boolean;
  /** Archived quests are left out unless this is set or `status` is `archived`. */
  includeArchived?: boolean;
  /**
   * Read the live state of the vote for quests that are still `proposed` (one chain read per
   * call). Off by default: the call then needs no chain read.
   */
  includeProposalStatus?: boolean;
  paging: { offset: number; limit: number };
};

export type QuestItem = {
  slug: string;
  name: string;
  /** As stored. A read never changes it. */
  status: QuestStatus;
  goal: string;
  scopeIn: string;
  scopeOut: string;
  successCriteria: string;
  /** `token` is a symbol; a contract address is never returned. */
  rewards: { amount: string; token: string | null }[];
  /** A calendar date as stored, or `null`. */
  targetDate: string | null;
  /** Display names only. */
  lead: string;
  members: {
    name: string;
    role: string | null;
    responsibilities: string[];
    isLead: boolean;
  }[];
  milestones: {
    order: number;
    name: string;
    description: string;
    dueDate: string | null;
    ownerName: string | null;
    status: QuestMilestoneStatus;
  }[];
  deliverables: { name: string; url: string | null; note: string | null }[];
  health: {
    state: QuestHealthState;
    marker: number;
    summary: string;
    updatesThisWeek: number;
    lastUpdateAt: string | null;
    daysToTarget: number | null;
  };
  /** The proposal that commits the quest. `null` when none is linked in this space. */
  proposal: { slug: string; status: ProposalListStatus | null } | null;
  /** The stored acceptance time (set when the quest was activated), or `null`. */
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  viewer: { isLead: boolean; isMember: boolean };
};

export type QuestCounts = Record<QuestStatus, number> & { total: number };

export type ListQuestsData = {
  items: QuestItem[];
  /** The quests the caller may see that match the filters, before paging. */
  total: number;
  /** Stored statuses over the quests of the space (narrowed by `mine` only). */
  counts: QuestCounts;
  asOf: string;
};

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * Feature function "list quests": the quests of one space. A quest is a commitment someone
 * is accountable for, committed through the space's agreement process (K92). It reads with
 * the plain list (`listSpaceQuests`) and writes nothing of any kind: it never activates a
 * quest, never opens a chat room, and never returns a draft (drafts live in their own table
 * and are author-private). The access policy runs first on the light host lookup, and no
 * rule per quest exists in the data model, so the space's access is the whole gate.
 */
export async function listQuests(
  input: ListQuestsInput,
  caller: Caller,
  { db }: DbConfig,
): Promise<{ ok: true; data: ListQuestsData } | Failure> {
  try {
    const host = await findSpaceHostFieldsBySlug(
      { slug: input.spaceSlug },
      { db },
    );
    if (!host) return failure('not_found', 'Space not found');

    const decision = await decideSpaceAccess(host, caller, { db });
    if (decision.outcome === 'none') {
      return decision.failure.code === 'access_check_failed'
        ? decision.failure
        : failure('not_found', 'Space not found');
    }

    const personId = caller.kind === 'user' ? caller.person.id : null;
    if (input.mine && personId === null) {
      return failure('unauthenticated', 'This needs a signed-in user.');
    }

    const overview = await listSpaceQuests({ spaceSlug: host.slug }, { db });
    if (!overview) return failure('not_found', 'Space not found');
    // Defence in depth: only the quests of the space that passed the policy.
    const ofSpace = overview.quests.filter(
      (quest) => quest.spaceId === host.id,
    );

    const isLead = (quest: QuestRecord) =>
      personId !== null && quest.leadPersonId === personId;
    const isMember = (quest: QuestRecord) =>
      personId !== null &&
      (isLead(quest) ||
        quest.members.some((member) => member.personId === personId));

    const narrowed = input.mine ? ofSpace.filter(isMember) : ofSpace;
    const counts: QuestCounts = {
      active: 0,
      proposed: 0,
      paused: 0,
      completed: 0,
      archived: 0,
      total: narrowed.length,
    };
    for (const quest of narrowed) counts[quest.status] += 1;

    const matching = narrowed.filter((quest) => {
      if (input.status) return quest.status === input.status;
      return input.includeArchived || quest.status !== 'archived';
    });
    const offset = Math.max(Math.trunc(input.paging.offset), 0);
    const limit = Math.min(Math.max(Math.trunc(input.paging.limit), 1), 100);
    const page = matching.slice(offset, offset + limit);

    // The linked proposal counts only when its document belongs to this same space.
    const documentIds = [
      ...new Set(
        page
          .map((quest) => quest.proposalDocumentId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const documents = await selectQuestProposalDocuments({ db }, documentIds);

    let outcomes: Awaited<ReturnType<typeof readProposalOutcomeIds>> | null =
      null;
    const wantsVote =
      input.includeProposalStatus === true &&
      typeof host.web3SpaceId === 'number' &&
      page.some(
        (quest) =>
          quest.status === 'proposed' &&
          quest.proposalDocumentId !== null &&
          documents.get(quest.proposalDocumentId)?.web3ProposalId != null,
      );
    if (wantsVote) {
      try {
        outcomes = await readProposalOutcomeIds(host.web3SpaceId as number);
      } catch (error) {
        console.error('[features] quest proposal outcome read failed', error);
        return failure(
          'chain_read_failed',
          'Proposal status could not be read from the chain.',
        );
      }
    }

    const items = page.map((quest): QuestItem => {
      const document =
        quest.proposalDocumentId !== null
          ? documents.get(quest.proposalDocumentId)
          : undefined;
      const linked =
        document && document.spaceId === host.id && document.slug
          ? document
          : null;
      const lead = isLead(quest);
      return {
        slug: quest.slug,
        name: quest.name,
        status: quest.status,
        goal: quest.goal,
        scopeIn: quest.scopeInMarkdown,
        scopeOut: quest.scopeOutMarkdown,
        successCriteria: quest.successCriteria,
        rewards: quest.rewards.map((reward) => ({
          amount: reward.amount,
          token: ADDRESS.test(reward.token.trim()) ? null : reward.token,
        })),
        targetDate: quest.targetDate,
        lead: stripViewerYouMarker(quest.leadName).trim(),
        members: quest.members.map((member) => ({
          name: stripViewerYouMarker(member.memberName).trim(),
          role: member.roleLabel,
          responsibilities: member.responsibilities,
          isLead: member.isLead === true,
        })),
        milestones: quest.milestones.map((milestone) => ({
          order: milestone.order,
          name: milestone.name,
          description: milestone.description,
          dueDate: milestone.dueDate,
          ownerName: milestone.ownerName,
          status: milestone.status,
        })),
        deliverables: quest.deliverables.map((deliverable) => ({
          name: deliverable.name,
          url: deliverable.url,
          note: deliverable.note,
        })),
        health: {
          state: quest.health.state,
          marker: quest.health.marker,
          summary: quest.health.summary,
          updatesThisWeek: quest.health.updatesThisWeek,
          lastUpdateAt: quest.health.lastUpdateAt,
          daysToTarget: quest.health.daysToTarget,
        },
        proposal: linked
          ? {
              slug: linked.slug as string,
              status:
                outcomes &&
                quest.status === 'proposed' &&
                linked.web3ProposalId != null
                  ? deriveProposalListStatus(linked.web3ProposalId, outcomes) ??
                    null
                  : null,
            }
          : null,
        acceptedAt: quest.acceptedAt,
        createdAt: quest.createdAt,
        updatedAt: quest.updatedAt,
        viewer: { isLead: lead, isMember: isMember(quest) },
      };
    });

    return {
      ok: true,
      data: {
        items,
        total: matching.length,
        counts,
        asOf: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[features] list quests failed', error);
    return failure(
      'access_check_failed',
      'Quests could not be listed right now.',
    );
  }
}
