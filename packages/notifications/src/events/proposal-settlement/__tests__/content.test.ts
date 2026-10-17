import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildProposalSettlementContent } from '../content';
import type { ProposalSettlementEvent } from '../resolver';
import type { Recipient } from '../../../core/types';
import { TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED } from '../../../constants';

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
    ).toEqual([TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED]);
    expect(
      buildProposalSettlementContent(rejected, creatorRecipient).requiredTags,
    ).toEqual([TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED]);
  });

  it('uses accepted copy for accepted and rejection copy for rejected', () => {
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
    ).toMatch(/accept/);
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

describe('buildProposalSettlementContent — email template', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const linkData = {
    spaceTitle: 'Hypha Energy',
    proposalTitle: 'Fund the thing',
    url: 'https://app.hypha.earth/en/dho/hypha-energy/agreements/proposal/fund',
    notificationSettingsUrl:
      'https://app.hypha.earth/en/network/notification-centre',
  };

  it.each([
    [
      'accepted',
      accepted,
      'creator',
      'EMAIL_TEMPLATE_PROPOSAL_ACCEPTED_CREATOR',
    ],
    [
      'accepted',
      accepted,
      'member',
      'EMAIL_TEMPLATE_PROPOSAL_ACCEPTED_MEMBERS',
    ],
    [
      'rejected',
      rejected,
      'creator',
      'EMAIL_TEMPLATE_PROPOSAL_REJECTED_CREATOR',
    ],
    [
      'rejected',
      rejected,
      'member',
      'EMAIL_TEMPLATE_PROPOSAL_REJECTED_MEMBERS',
    ],
  ] as const)('%s / %s uses %s', (_name, evt, role, envVar) => {
    vi.stubEnv(envVar, 'tpl-x');
    const result = buildProposalSettlementContent(evt, {
      personSlug: 'p',
      role,
      data: linkData,
    });
    expect(result.content.email).toEqual({
      kind: 'template',
      templateId: 'tpl-x',
      customData: {
        space_title: 'Hypha Energy',
        proposal_title: 'Fund the thing',
        url: linkData.url,
        notification_settings_url: linkData.notificationSettingsUrl,
      },
    });
  });

  it('falls back to plain email without the env var', () => {
    vi.stubEnv('EMAIL_TEMPLATE_PROPOSAL_ACCEPTED_CREATOR', '');
    const result = buildProposalSettlementContent(accepted, creatorRecipient);
    expect(result.content.email).toMatchObject({ kind: 'plain' });
  });

  it.each([
    [
      'accepted',
      accepted,
      'creator',
      'PUSH_TEMPLATE_PROPOSAL_ACCEPTED_CREATOR',
    ],
    ['accepted', accepted, 'member', 'PUSH_TEMPLATE_PROPOSAL_ACCEPTED_MEMBERS'],
    [
      'rejected',
      rejected,
      'creator',
      'PUSH_TEMPLATE_PROPOSAL_REJECTED_CREATOR',
    ],
    ['rejected', rejected, 'member', 'PUSH_TEMPLATE_PROPOSAL_REJECTED_MEMBERS'],
  ] as const)('push: %s / %s uses %s', (_name, evt, role, envVar) => {
    vi.stubEnv(envVar, 'push-x');
    const result = buildProposalSettlementContent(evt, {
      personSlug: 'p',
      role,
      data: { ...linkData, proposalLabel: 'Invite' },
    });
    expect(result.content.push).toEqual({
      kind: 'template',
      templateId: 'push-x',
      customData: {
        space_title: 'Hypha Energy',
        proposal_title: 'Fund the thing',
        proposal_kind: 'Invite',
        url: linkData.url,
      },
      url: linkData.url,
    });
  });

  it('push: plain fallback carries the launch url', () => {
    vi.stubEnv('PUSH_TEMPLATE_PROPOSAL_ACCEPTED_CREATOR', '');
    const result = buildProposalSettlementContent(accepted, {
      personSlug: 'alice',
      role: 'creator',
      data: linkData,
    });
    expect(result.content.push).toMatchObject({
      kind: 'plain',
      url: linkData.url,
    });
  });
});
