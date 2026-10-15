import { describe, expect, it } from 'vitest';

import {
  pushProposalCreationForMembers,
  pushProposalExecutionForCreator,
} from '..';

describe('pushProposalExecutionForCreator (dashboard: [PUSH] Proposal - Accepted - for Creator)', () => {
  it('matches the dashboard title and message', () => {
    const push = pushProposalExecutionForCreator({
      proposalTitle: 'Plan',
      spaceTitle: 'Acme',
    });
    expect(push.headings).toEqual({ en: 'Your proposal was accepted' });
    expect(push.contents).toEqual({
      en: 'Your proposal “Plan” was accepted in Acme.',
    });
  });

  it('defaults the space and omits a missing title', () => {
    expect(pushProposalExecutionForCreator({}).contents).toEqual({
      en: 'Your proposal was accepted in your space.',
    });
  });
});

describe('pushProposalCreationForMembers (dashboard: [PUSH] Proposal - Created - for Members)', () => {
  it('matches the dashboard proposal variant', () => {
    const push = pushProposalCreationForMembers({
      creatorName: 'Alice',
      proposalTitle: 'Plan',
      spaceTitle: 'Acme',
    });
    expect(push.headings).toEqual({ en: 'New proposal in Acme' });
    expect(push.contents).toEqual({
      en: 'Alice created a new proposal “Plan”. Have a look and vote.',
    });
  });

  it('matches the dashboard join-request variant and defaults', () => {
    const push = pushProposalCreationForMembers({ proposalLabel: 'Invite' });
    expect(push.headings).toEqual({ en: 'New join request in your space' });
    expect(push.contents).toEqual({ en: 'Someone wants to join your space.' });
  });
});
