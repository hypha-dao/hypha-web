import { describe, expect, it, vi } from 'vitest';

// The client barrel type-imports the upload router. Vitest evaluates that
// module, and `server-only` throws outside the Next.js compiler.
vi.mock('server-only', () => ({}));

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
      description: null,
      creatorId: null,
      creatorName: null,
      creatorAvatarUrl: null,
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
    expect(facts).toContain('kind=proposal slug=path document=proposal');
    expect(facts).toContain('show_member_home_item');
    expect(facts).toContain('Noor');
    expect(facts).toContain('focused on their own spaces');
    expect(facts).not.toContain('Circle');
    expect(facts).not.toContain('You are a personal');
    expect(facts).toContain("don't want to decide");
    expect(facts).toContain('if you need any assistance');
    expect(facts).toContain('Would you like to take part in one of them?');
    expect(facts).toContain('Asking for context or a discussion is not a no');
  });

  it('removes an item the member already refused from the queue', () => {
    const facts = formatMemberHomeFacts(home, {
      passed: ['proposal:path'],
    });
    expect(facts).toContain('Passed.');
    expect(facts).toContain('proposal:path');
    expect(facts).toContain('Nothing left in the queue');
    expect(facts).not.toContain('1. kind=proposal slug=path');
  });
});
