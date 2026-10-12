import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildProposalCreatedContent } from '../content';
import type { ProposalCreatedEvent, Recipient } from '../../../core/types';
import { TAG_SUB_NEW_PROPOSAL_OPEN } from '../../../constants';

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

describe('buildProposalCreatedContent — email template', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const data = {
    spaceTitle: 'Hypha Energy',
    proposalTitle: 'Fund the thing',
    url: 'https://app.hypha.earth/en/dho/hypha-energy/agreements/proposal/fund',
    notificationSettingsUrl:
      'https://app.hypha.earth/en/network/notification-centre',
  };

  it('creator: uses the creator template and greets the recipient by name', () => {
    vi.stubEnv('EMAIL_TEMPLATE_PROPOSAL_CREATED_CREATOR', 'tpl-creator');
    const result = buildProposalCreatedContent(event, {
      personSlug: 'alice',
      displayName: 'Alice',
      role: 'creator',
      data,
    });
    expect(result.content.email).toEqual({
      kind: 'template',
      templateId: 'tpl-creator',
      customData: {
        user_name: 'Alice',
        space_title: 'Hypha Energy',
        proposal_title: 'Fund the thing',
        url: data.url,
        notification_settings_url: data.notificationSettingsUrl,
      },
    });
  });

  it('members: uses the members template and names who created it', () => {
    vi.stubEnv('EMAIL_TEMPLATE_PROPOSAL_CREATED_MEMBERS', 'tpl-members');
    const result = buildProposalCreatedContent(
      { ...event, payload: { proposalLabel: 'Invite' } },
      {
        personSlug: 'bob',
        role: 'member',
        data: { ...data, creatorName: 'Alice' },
      },
    );
    expect(result.content.email).toMatchObject({
      kind: 'template',
      templateId: 'tpl-members',
      customData: { creator_name: 'Alice', proposal_kind: 'Invite' },
    });
  });

  it('keeps push plain and falls back to plain email without the env var', () => {
    vi.stubEnv('EMAIL_TEMPLATE_PROPOSAL_CREATED_CREATOR', '');
    const result = buildProposalCreatedContent(event, {
      personSlug: 'alice',
      role: 'creator',
      data,
    });
    expect(result.content.email).toMatchObject({ kind: 'plain' });
    expect(result.content.push).toMatchObject({ kind: 'plain' });
  });
});
