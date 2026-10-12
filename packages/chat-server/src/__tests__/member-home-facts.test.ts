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
    expect(facts).toContain('The collective is the point');
    expect(facts).toContain('No open question');
    expect(facts).toContain('Ada Lovelace');
    expect(facts).toContain('Grove');
    expect(facts).toContain('Open the path');
    expect(facts).toContain('kind=proposal slug=path document=proposal');
    expect(facts).toContain('show_member_home_item');
    expect(facts).toContain('Noor');
    expect(facts).toContain('Never suggest they connect with themselves');
    expect(facts).toContain('No network signal is in this brief');
    expect(facts).not.toContain('Circle');
    expect(facts).not.toContain('You are a personal');
    expect(facts).toContain("don't want to decide");
    expect(facts).toContain('if you need any assistance');
    expect(facts).toContain('Would you like to take part in one of them?');
    expect(facts).toContain('Asking for context or a discussion is not a no');
    expect(facts).toContain(
      'Use only the person, the space, the task, and the token written on that item.',
    );
    expect(facts).not.toContain('Teo');
    expect(facts).not.toContain('plum jam');
    expect(facts).toContain("I'll show you the proposal now.");
    expect(facts).toContain('Could you let me know if you approve');
    expect(facts).toContain(
      'What would you like to decide regarding this proposal?',
    );
    expect(facts).toContain("I've approved");
    expect(facts).toContain('You can now decide on the proposal card.');
    expect(facts).toContain('speak to them by name');
    expect(facts).toContain('Never say they are on their home');
    expect(facts).toContain(
      'A proposal they have already voted on is absent from the waiting list.',
    );
    expect(facts).toContain(
      'An expired proposal is absent from the waiting list.',
    );
    expect(facts).toContain("I don't want to look");
    expect(facts).toContain('You are not in the decision');
    expect(facts).toContain('action=decision');
    expect(facts).toContain("using that person's name from the record");
    expect(facts).toContain(
      'Do not invent the person, the task, or the token.',
    );
    expect(facts).toContain('Never make a recipe');
    expect(facts).toContain('Do not call it a chat');
    expect(facts).toContain('think about it');
  });

  it('puts who they are and who they share a space with on the decision line', () => {
    const facts = formatMemberHomeFacts({
      ...home,
      proposals: [
        {
          ...home.proposals[0]!,
          creatorId: 8,
          creatorName: 'Gerardo Roza',
          creatorAbout: 'Grows food in Rotterdam',
          creatorWith: ['Ada Lovelace', 'Noor', 'Teo'],
        },
      ],
      connections: [
        {
          id: 8,
          slug: 'gerardo',
          name: 'Gerardo',
          surname: 'Roza',
          nickname: null,
          avatarUrl: null,
          sharedSpaceCount: 3,
        },
      ],
    });
    expect(facts).toContain('creator="Gerardo Roza"');
    expect(facts).toContain('spoken=he');
    expect(facts).toContain('about="Grows food in Rotterdam"');
    expect(facts).toContain('shares=3');
    expect(facts).toContain('with="Noor; Teo"');
    expect(facts).not.toContain('with="Ada Lovelace');
  });

  it('does not offer the signed-in member as someone to meet', () => {
    const facts = formatMemberHomeFacts({
      ...home,
      connections: [
        ...home.connections,
        {
          id: home.person.id,
          slug: home.person.slug,
          name: home.person.name,
          surname: home.person.surname,
          nickname: null,
          avatarUrl: null,
          sharedSpaceCount: 4,
        },
      ],
    });
    expect(facts).toContain('People who share a space, closest first: Noor');
    expect(facts).not.toContain('Ada Lovelace (shared spaces:');
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

  it('brings a deferred item back only as a good time', () => {
    const facts = formatMemberHomeFacts(home, {
      deferred: ['proposal:path'],
    });
    expect(facts).toContain('is this a good time');
    expect(facts).toContain('Deferred.');
    expect(facts).not.toContain('1. kind=proposal slug=path');
  });

  it('does not ask if this is a good time a second time', () => {
    const facts = formatMemberHomeFacts(home, {
      recalled: ['proposal:path'],
    });
    expect(facts).toContain('Already asked once if this is a good time');
    expect(facts).not.toContain('1. kind=proposal slug=path');
    expect(facts).not.toContain('Bring back the deferred item once');
  });

  it('continues with the next item after they come back', () => {
    const facts = formatMemberHomeFacts(
      {
        ...home,
        proposals: [
          home.proposals[0]!,
          {
            ...home.proposals[0]!,
            id: 10,
            slug: 'bridge',
            title: 'Build the bridge',
          },
        ],
      },
      { acted: ['proposal:path'], resumed: true },
    );
    expect(facts).toContain('One short glad line, then the next waiting item');
    expect(facts).toContain('The flow continues');
    expect(facts).toContain('slug=bridge');
    expect(facts).toContain('Build the bridge');
    expect(facts).not.toContain('slug=path');
    expect(facts).toContain('proposal:path');
  });
});
