import { describe, expect, it } from 'vitest';

import {
  pushProposalCreationForCreator,
  pushProposalExecutionForMembers,
  pushProposalRejectionForCreator,
  pushSpaceCreationForCreator,
} from '..';

describe('push copy aligned with the dashboard templates', () => {
  it('[PUSH] Proposal - Accepted - for Members', () => {
    const push = pushProposalExecutionForMembers({
      proposalTitle: 'Plan',
      spaceTitle: 'Acme',
    });
    expect(push.headings).toEqual({ en: 'A proposal was accepted in Acme' });
    expect(push.contents).toEqual({ en: 'A proposal “Plan” was accepted.' });
    expect(pushProposalExecutionForMembers({}).headings).toEqual({
      en: 'A proposal was accepted in your space',
    });
  });

  it('[PUSH] Proposal - Created - for Creator', () => {
    const proposal = pushProposalCreationForCreator({
      proposalTitle: 'Plan',
      spaceTitle: 'Acme',
    });
    expect(proposal.headings).toEqual({ en: 'Your proposal was created' });
    expect(proposal.contents).toEqual({
      en: 'Your proposal “Plan” was created in Acme.',
    });

    const invite = pushProposalCreationForCreator({
      proposalLabel: 'Invite',
      spaceTitle: 'Acme',
    });
    expect(invite.headings).toEqual({ en: 'Your invite was created' });
    expect(invite.contents).toEqual({
      en: 'Your invite to join Acme was created.',
    });
  });

  it('[PUSH] Proposal - Rejected - for Creator', () => {
    const push = pushProposalRejectionForCreator({
      proposalTitle: 'Plan',
      spaceTitle: 'Acme',
    });
    expect(push.headings).toEqual({ en: 'Your proposal was rejected' });
    expect(push.contents).toEqual({
      en: 'Your proposal “Plan” was rejected in Acme.',
    });
  });

  it('[PUSH] Space - Created', () => {
    expect(pushSpaceCreationForCreator({ spacesCount: 1 })).toEqual({
      headings: { en: 'Successful space creation' },
      contents: { en: "You've successfully created a space." },
    });
    expect(pushSpaceCreationForCreator({ spacesCount: 3 }).contents).toEqual({
      en: "You've successfully created 3 spaces.",
    });
  });
});
