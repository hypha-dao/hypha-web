import type { QuestListFilter } from './constants';
import type { QuestRecord, SpaceQuestsOverview } from './types';

/**
 * A proposed quest whose governing proposal is in the on-chain rejected set.
 * That set is `getSpaceProposals`'s second list: the vote failed, or the
 * proposal expired without execution. Creator withdrawals are not in this
 * set as rejected; `attachProposalStatusToDocument` leaves them without a
 * status, so they stay Proposed. Accepted proposals are activated separately.
 */
export function isRejectedProposedQuest(
  quest: Pick<QuestRecord, 'status' | 'proposalStatus'>,
): boolean {
  return quest.status === 'proposed' && quest.proposalStatus === 'rejected';
}

/** List chip a quest belongs to. Archived quests are not a chip. */
export function questListBucket(
  quest: Pick<QuestRecord, 'status' | 'proposalStatus'>,
): QuestListFilter | 'archived' {
  if (isRejectedProposedQuest(quest)) return 'rejected';
  if (quest.status === 'archived') return 'archived';
  return quest.status;
}

export function questOverviewCounts(
  quests: readonly Pick<QuestRecord, 'status' | 'proposalStatus'>[],
): SpaceQuestsOverview['counts'] {
  const counts: SpaceQuestsOverview['counts'] = {
    active: 0,
    proposed: 0,
    paused: 0,
    completed: 0,
    rejected: 0,
    archived: 0,
    total: 0,
  };
  for (const quest of quests) {
    counts[questListBucket(quest)] += 1;
    if (quest.status !== 'archived') counts.total += 1;
  }
  return counts;
}

export function applyProposalStatusesToOverview(
  overview: SpaceQuestsOverview,
  statusByDocumentId: ReadonlyMap<number, 'accepted' | 'rejected' | 'onVoting'>,
): SpaceQuestsOverview {
  const quests = overview.quests.map((quest) => {
    if (quest.proposalDocumentId == null) return quest;
    const status = statusByDocumentId.get(quest.proposalDocumentId);
    if (!status) return quest;
    return { ...quest, proposalStatus: status };
  });
  return {
    ...overview,
    quests,
    counts: questOverviewCounts(quests),
  };
}
