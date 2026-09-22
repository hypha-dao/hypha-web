import { describe, expect, it } from 'vitest';

import { buildProposalSettlementContent } from './content';
import type { ProposalSettlementEvent } from './resolver';
import type { Recipient } from '../../core/types';
import { TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED } from '../../constants';

const accepted: ProposalSettlementEvent = {
  type: 'proposal.accepted',
  source: { kind: 'domain', entityType: 'proposal', entityId: '1' },
  context: { proposalWeb3Id: 1 },
};

const rejected: ProposalSettlementEvent = {
  ...accepted,
  type: 'proposal.rejected',
};

const creatorRecipient: Recipient = {
  personSlug: 'alice',
  role: 'creator',
  data: { spaceTitle: 'Hypha Energy', proposalTitle: 'Fund the thing' },
};

const memberRecipient: Recipient = {
  personSlug: 'bob',
  role: 'member',
  data: { spaceTitle: 'Hypha Energy', proposalTitle: 'Fund the thing' },
};

describe('buildProposalSettlementContent', () => {
  it('gates on sub_proposalApprovedOrRejected for both accepted and rejected', () => {
    expect(
      buildProposalSettlementContent(accepted, creatorRecipient).requiredTags,
    ).toEqual({
      [TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED]: 'true',
    });
    expect(
      buildProposalSettlementContent(rejected, creatorRecipient).requiredTags,
    ).toEqual({
      [TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED]: 'true',
    });
  });

  it('uses execution copy for accepted and rejection copy for rejected', () => {
    const acceptedContent = buildProposalSettlementContent(
      accepted,
      creatorRecipient,
    );
    const rejectedContent = buildProposalSettlementContent(
      rejected,
      creatorRecipient,
    );

    expect(
      (
        acceptedContent.content.email as { subject: string }
      ).subject.toLowerCase(),
    ).toMatch(/execut/);
    expect(
      (
        rejectedContent.content.email as { subject: string }
      ).subject.toLowerCase(),
    ).toMatch(/reject/);
  });

  it('never mentions a creator name — the original queries never fetched one', () => {
    const content = buildProposalSettlementContent(accepted, memberRecipient);
    const body = (content.content.email as { body: string }).body;

    // Falls back to the template's default ('Someone') rather than a real name.
    expect(body).not.toContain('Alice');
  });
});
