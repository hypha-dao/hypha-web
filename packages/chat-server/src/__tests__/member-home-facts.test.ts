import { describe, expect, it } from 'vitest';

import type { MemberIntelligence } from '@hypha-platform/core/client';

import { formatMemberHomeFacts } from '../member-home-facts';

const home: MemberIntelligence = {
  person: {
    id: 1,
    slug: 'ada',
    name: 'Ada',
    surname: 'Lovelace',
    nickname: null,
    avatarUrl: null,
    description: null,
    address: null,
    preferredCurrency: 'EUR',
    primaryOrientation: 'member',
  },
  counts: {
    spaces: 1,
    openProposals: 1,
    signals: 0,
    connections: 1,
    notifications: 0,
    capitalAsks: 0,
  },
  guidance: { narrative: 'Hi Ada.' },
  attention: [],
  spaces: [
    {
      id: 4,
      slug: 'grove',
      title: 'Grove',
      description: '',
      logoUrl: null,
    },
  ],
  proposals: [
    {
      id: 9,
      slug: 'path',
      title: 'Open the path',
      state: 'proposal',
      label: null,
      spaceSlug: 'grove',
      spaceTitle: 'Grove',
      createdAt: '2026-01-01T00:00:00.000Z',
      authoredByMember: false,
      web3ProposalId: 12,
    },
  ],
  signals: [],
  notifications: [],
  connections: [
    {
      id: 2,
      slug: 'noor',
      name: 'Noor',
      surname: null,
      nickname: null,
      avatarUrl: null,
      sharedSpaceCount: 2,
    },
  ],
  wallet: { address: null, preferredCurrency: 'EUR' },
  chatSpaceSlug: 'grove',
  invites: [],
};

describe('formatMemberHomeFacts', () => {
  it('keeps Hypha AI voice and lists this member’s world', () => {
    const facts = formatMemberHomeFacts(home);
    expect(facts).toContain('Keep the Hypha AI voice');
    expect(facts).toContain('Ada Lovelace');
    expect(facts).toContain('Grove');
    expect(facts).toContain('Open the path');
    expect(facts).toContain('Noor');
    expect(facts).not.toContain('Circle');
    expect(facts).not.toContain('You are a personal');
  });
});
