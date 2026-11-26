import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('../queries', () => ({
  listSpaceQuests: vi.fn(async () => ({
    spaceSlug: 'alpha',
    spaceTitle: 'Alpha',
    // An active quest whose channel was never opened: the sync retries the activation.
    quests: [{ status: 'active', proposalDocumentId: 9, chatRoomId: null }],
    counts: {},
  })),
}));
vi.mock('../mutations', () => ({
  activateSpaceQuestByDocumentId: vi.fn(async () => 0),
}));

import { activateSpaceQuestByDocumentId } from '../mutations';
import {
  QUEST_PROPOSAL_STATUS_SYNC_SOURCE,
  syncSpaceQuestProposalStatuses,
} from '../sync-proposal-status';

describe('syncSpaceQuestProposalStatuses origin (#2724)', () => {
  it('activates with the platform origin labelled as the status sync', async () => {
    await syncSpaceQuestProposalStatuses(
      { spaceSlug: 'alpha' },
      { db: {} as never },
    );
    const [, options] = vi.mocked(activateSpaceQuestByDocumentId).mock
      .calls[0]!;
    expect(options.origin).toMatchObject({
      kind: 'hypha_platform',
      clientId: null,
      clientLabel: QUEST_PROPOSAL_STATUS_SYNC_SOURCE,
    });
  });
});
