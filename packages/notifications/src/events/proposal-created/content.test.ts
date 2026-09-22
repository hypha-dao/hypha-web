import { describe, expect, it } from 'vitest';

import { buildProposalCreatedContent } from './content';
import type { ProposalCreatedEvent, Recipient } from '../../core/types';
import { TAG_SUB_NEW_PROPOSAL_OPEN } from '../../constants';

const event: ProposalCreatedEvent = {
  type: 'proposal.created',
  source: { kind: 'domain', entityType: 'proposal', entityId: '1' },
  context: { proposalWeb3Id: 1n, spaceWeb3Id: 2n, creatorWeb3Address: '0xabc' },
  payload: {},
};

describe('buildProposalCreatedContent', () => {
  it('addresses the creator by their own name, gated on sub_newProposalOpen', () => {
    const recipient: Recipient = {
      personSlug: 'alice',
      displayName: 'Alice',
      role: 'creator',
      data: { spaceTitle: 'Hypha Energy' },
    };

    const result = buildProposalCreatedContent(event, recipient);

    expect(result.channels).toEqual(['push', 'email']);
    expect(result.requiredTags).toEqual({
      [TAG_SUB_NEW_PROPOSAL_OPEN]: 'true',
    });
    expect(result.content.email).toMatchObject({ kind: 'plain' });
    expect((result.content.email as { body: string }).body).toContain('Alice');
    expect((result.content.email as { body: string }).body).toContain(
      'Hypha Energy',
    );
    expect(result.content.push).toMatchObject({ kind: 'plain' });
  });

  it('names the creator (not the member) in the member content', () => {
    const recipient: Recipient = {
      personSlug: 'bob',
      role: 'member',
      data: { spaceTitle: 'Hypha Energy', creatorName: 'Alice' },
    };

    const result = buildProposalCreatedContent(event, recipient);

    expect((result.content.email as { body: string }).body).toContain('Alice');
    expect(
      (result.content.push as { contents: { en: string } }).contents.en,
    ).not.toContain('Alice');
  });

  it('renders join-request copy when proposalLabel is Invite', () => {
    const invite: ProposalCreatedEvent = {
      ...event,
      payload: { proposalLabel: 'Invite' },
    };
    const result = buildProposalCreatedContent(invite, {
      personSlug: 'alice',
      role: 'creator',
    });

    expect(
      (result.content.email as { subject: string }).subject.toLowerCase(),
    ).toContain('invite');
  });
});
