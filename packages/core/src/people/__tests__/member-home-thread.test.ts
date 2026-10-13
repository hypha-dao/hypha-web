import { describe, expect, it } from 'vitest';

import type { MemberIntelligence } from '../member-intelligence';
import {
  SHOW_MEMBER_HOME_ITEM_TOOL,
  listMemberHomeAttentionItems,
  listMemberHomeThreadItems,
  mergeMemberHomeAttention,
  memberHomeBoardDestination,
  memberHomeItemsStillWaiting,
  memberHomeSignalAction,
  memberHomeSignalCatalogue,
  memberHomeSignalCtas,
  memberHomeThreadItemForMessage,
  memberHomeItemMemory,
  passedMemberHomeItemKeys,
  shownMemberHomeItemKeys,
} from '../member-home-thread';

const home: MemberIntelligence = {
  person: {
    id: 1,
    slug: 'ada',
    name: 'Ada',
    surname: null,
    nickname: null,
    avatarUrl: null,
    description: null,
    address: null,
    preferredCurrency: null,
    primaryOrientation: 'member',
  },
  counts: {
    spaces: 2,
    openProposals: 1,
    signals: 1,
    connections: 0,
    notifications: 2,
    capitalAsks: 0,
  },
  guidance: { narrative: '' },
  attention: [
    {
      id: 'signal-2',
      kind: 'signal',
      title: 'Define products to be sold soon',
      detail: 'Hypha Energy · a signal',
      spaceSlug: 'hypha-energy',
      spaceTitle: 'Hypha Energy',
      targetSlug: 'define-products',
    },
    {
      id: 'proposal-9',
      kind: 'proposal',
      title: 'Invite Member',
      detail: 'Hypha Pollinate · a decision',
      spaceSlug: 'hypha-pollinate',
      spaceTitle: 'Hypha Pollinate',
      targetSlug: 'invite-member',
    },
  ],
  spaces: [],
  proposals: [
    {
      id: 9,
      slug: 'invite-member',
      title: 'Invite Member',
      state: 'proposal',
      label: null,
      spaceSlug: 'hypha-pollinate',
      spaceTitle: 'Hypha Pollinate',
      createdAt: '2026-01-01T00:00:00.000Z',
      authoredByMember: false,
      web3ProposalId: 41,
      description: null,
      creatorId: null,
      creatorName: null,
      creatorAvatarUrl: null,
    },
  ],
  signals: [
    {
      id: 2,
      slug: 'define-products',
      title: 'Define products to be sold soon',
      type: 'opportunity',
      priority: 'high',
      spaceSlug: 'hypha-energy',
      spaceTitle: 'Hypha Energy',
      assignedToMember: true,
      description: null,
      creatorId: null,
      creatorName: null,
      creatorAvatarUrl: null,
    },
  ],
  notifications: [],
  connections: [],
  wallet: { address: null, preferredCurrency: null },
  chatSpaceSlug: 'hypha-pollinate',
  invites: [],
};

describe('listMemberHomeThreadItems', () => {
  it('leaves out a proposal this member has already voted on', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      proposals: [{ ...home.proposals[0]!, memberHasVoted: true }],
    });
    expect(items.map((item) => item.slug)).toEqual(['define-products']);
  });

  it('leaves out a closed vote that has no recorded outcome', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      proposals: [{ ...home.proposals[0]!, expired: true }],
    });
    expect(items.map((item) => item.slug)).toEqual(['define-products']);
  });

  it('drops an item from the waiting list once the member clears it', () => {
    const items = listMemberHomeThreadItems(home);
    const open = memberHomeItemsStillWaiting(items, {
      passed: ['proposal:invite-member'],
      acted: ['signal:define-products'],
    });
    expect(open).toEqual([]);
  });

  it('keeps a deferred item when the chat brings it back', () => {
    const items = listMemberHomeThreadItems(home);
    const open = memberHomeItemsStillWaiting(items, {
      deferred: ['proposal:invite-member'],
      recalled: ['proposal:invite-member'],
    });
    expect(open.map((item) => item.slug)).toEqual([
      'define-products',
      'invite-member',
    ]);
  });

  it('tells a closed vote as the outcome, not a decision', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      proposals: [
        {
          ...home.proposals[0]!,
          expired: true,
          outcome: { passed: true, participation: 62, unity: 91 },
        },
      ],
    });
    const proposal = items.find((item) => item.slug === 'invite-member');
    expect(proposal).toMatchObject({
      action: 'outcome',
      passed: true,
      participation: 62,
      unity: 91,
    });
  });

  it('keeps every open proposal in attention, newest first', () => {
    const items = listMemberHomeAttentionItems({
      ...home,
      proposals: [
        home.proposals[0]!,
        {
          ...home.proposals[0]!,
          id: 10,
          slug: 'invite-edgar',
          title: 'Invite Edgar',
          spaceSlug: 'localscale',
          spaceTitle: 'Localscale',
          createdAt: '2026-10-13T12:00:00.000Z',
          web3ProposalId: 88,
        },
        {
          ...home.proposals[0]!,
          id: 11,
          slug: 'invite-older',
          title: 'Older invite',
          createdAt: '2025-06-01T00:00:00.000Z',
          web3ProposalId: 12,
        },
      ],
    });
    expect(items.map((item) => item.slug)).toEqual([
      'invite-edgar',
      'invite-member',
      'invite-older',
      'define-products',
    ]);
  });

  it('keeps attention still while new items arrive and finished ones leave', () => {
    const source = listMemberHomeAttentionItems(home);
    const invite = source.find((item) => item.slug === 'invite-member');
    const signal = source.find((item) => item.slug === 'define-products');
    if (!invite || !signal) throw new Error('fixture items missing');
    const fresh = {
      ...invite,
      slug: 'invite-edgar',
      title: 'Invite Edgar',
    };
    const merged = mergeMemberHomeAttention([signal, invite], [fresh, signal]);
    expect(merged.map((item) => item.slug)).toEqual([
      'invite-edgar',
      'define-products',
    ]);
  });

  it('leaves out a proposal that has no chain vote left', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      proposals: [{ ...home.proposals[0]!, web3ProposalId: null }],
    });
    expect(items.map((item) => item.slug)).toEqual(['define-products']);
  });

  it('leaves out a proposal that has already become an agreement', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      proposals: [
        { ...home.proposals[0]!, state: 'agreement', web3ProposalId: 41 },
      ],
    });
    expect(items.map((item) => item.slug)).toEqual(['define-products']);
  });

  it('leaves out the signed-in member joining a space', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      person: { ...home.person, name: 'Alex', surname: 'Prate' },
      attention: [
        ...home.attention,
        {
          id: 'signal-join',
          kind: 'signal',
          title: 'Alex Prate joined',
          detail: 'tesesseer',
          spaceSlug: 'tesesseer',
          spaceTitle: 'tesesseer',
          targetSlug: 'alex-joined',
        },
      ],
    });
    expect(items.map((item) => item.title)).not.toContain('Alex Prate joined');
    expect(items.map((item) => item.slug)).toContain('invite-member');
  });

  it('leads with notifications and does not repeat a slug', () => {
    const items = listMemberHomeThreadItems(home);
    expect(items.map((item) => item.slug)).toEqual([
      'define-products',
      'invite-member',
    ]);
    expect(items[0]?.action).toBe('validate');
    expect(items[0]?.documentKind).toBe('signal');
    expect(items[1]?.action).toBe('decision');
    expect(items[1]?.documentKind).toBe('proposal');
  });

  it('keeps the signal category and the person who raised it', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      signals: [
        {
          ...home.signals[0],
          type: 'Need',
          description: 'Three rafts.',
          creatorId: 4,
          creatorName: 'Sara',
          creatorAvatarUrl: null,
        },
      ],
    });
    expect(items[0]).toEqual(
      expect.objectContaining({
        category: 'Need',
        creatorName: 'Sara',
        summary: 'Three rafts.',
      }),
    );
  });

  it('leaves out a signal this member raised unless the deadline is close', () => {
    const own = {
      ...home.signals[0]!,
      slug: 'estate-planning',
      title: 'Estate Planning',
      creatorId: home.person.id,
      creatorName: 'Ada',
    };
    const hidden = listMemberHomeThreadItems({
      ...home,
      signals: [own],
    });
    expect(hidden.map((item) => item.slug)).not.toContain('estate-planning');

    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const shown = listMemberHomeThreadItems({
      ...home,
      signals: [{ ...own, dueAt: soon }],
    });
    expect(shown.find((item) => item.slug === 'estate-planning')).toEqual(
      expect.objectContaining({ authoredByMember: true, dueAt: soon }),
    );
  });

  it('keeps a signal someone else raised ahead of the member’s own', () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const items = listMemberHomeThreadItems({
      ...home,
      attention: [],
      proposals: [],
      signals: [
        {
          ...home.signals[0]!,
          slug: 'estate-planning',
          title: 'Estate Planning',
          priority: 'high',
          creatorId: home.person.id,
          creatorName: 'Ada',
          dueAt: soon,
        },
        {
          ...home.signals[0]!,
          id: 8,
          slug: 'budgeting',
          title: 'Budgeting',
          priority: 'low',
          creatorId: 4,
          creatorName: 'Sara',
        },
      ],
    });
    expect(items.map((item) => item.slug)).toEqual([
      'estate-planning',
      'budgeting',
    ]);
    expect(
      items.find((item) => item.slug === 'budgeting')?.authoredByMember,
    ).toBe(false);
  });

  it('keeps a real category when the record is only marked signal', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      signals: [],
      attention: [
        {
          ...home.attention[0]!,
          category: 'Action',
        },
      ],
    });
    expect(
      items.find((item) => item.slug === 'define-products')?.category,
    ).toBe('Action');
  });

  it('puts a high-priority signal ahead of a discussion and a vote', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      proposals: [
        {
          ...home.proposals[0],
          slug: 'winter-notes',
          title: 'Winter notes',
          state: 'discussion',
          createdAt: '2026-06-01T00:00:00.000Z',
        },
        home.proposals[0],
      ],
    });
    expect(items.map((item) => item.slug)).toEqual([
      'define-products',
      'invite-member',
      'winter-notes',
    ]);
    expect(items[2]?.documentKind).toBe('discussion');
  });

  it('keeps a discussion’s own kind instead of calling it a proposal', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      attention: [],
      proposals: [
        {
          ...home.proposals[0],
          slug: 'winter-notes',
          title: 'Winter notes',
          state: 'discussion',
          label: null,
        },
      ],
      signals: [],
    });
    expect(items).toEqual([
      expect.objectContaining({
        kind: 'proposal',
        slug: 'winter-notes',
        documentKind: 'discussion',
      }),
    ]);
  });
});

describe('memberHomeSignalCtas', () => {
  it('offers a hand for a need and a conversation for tension', () => {
    expect(memberHomeSignalAction('Need')).toBe('help');
    expect(memberHomeSignalAction('Resource')).toBe('share');
    expect(memberHomeSignalAction('Action')).toBe('take');
    expect(memberHomeSignalAction('Impact')).toBe('impact');
    expect(memberHomeSignalAction('Tension')).toBe('call');
    expect(
      memberHomeSignalCtas({ category: 'Insight', hasCreator: true })[0],
    ).toBe('context');
    expect(
      memberHomeSignalCtas({ category: 'Risk', hasCreator: false })[0],
    ).toBe('discuss');
  });
});

describe('memberHomeThreadItemForMessage', () => {
  const items = listMemberHomeThreadItems(home);

  it('ties a card to the tool call on that reply', () => {
    const item = memberHomeThreadItemForMessage(items, {
      parts: [
        { type: 'text', text: 'Hypha Energy has something for you.' },
        {
          type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
          state: 'output-available',
          input: { kind: 'signal', slug: 'define-products' },
        },
      ],
    });
    expect(item?.slug).toBe('define-products');
  });

  it('ignores a tool call for an item that is not waiting', () => {
    const item = memberHomeThreadItemForMessage(items, {
      parts: [
        {
          type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
          state: 'output-available',
          input: { kind: 'proposal', slug: 'someone-else' },
        },
      ],
    });
    expect(item).toBeNull();
  });

  it('uses a single named title when the tool was not called', () => {
    const item = memberHomeThreadItemForMessage(items, {
      parts: [
        {
          type: 'text',
          text: 'Invite Member is the decision waiting in Hypha Pollinate.',
        },
      ],
    });
    expect(item?.slug).toBe('invite-member');
  });

  it('does not attach every card when a reply names more than one item', () => {
    const item = memberHomeThreadItemForMessage(items, {
      parts: [
        {
          type: 'text',
          text: 'Invite Member and Define products to be sold soon are both open.',
        },
      ],
    });
    expect(item).toBeNull();
  });

  it('uses the person named in the reply when the title is absent', () => {
    const item = memberHomeThreadItemForMessage(
      [
        {
          ...items[1],
          creatorName: 'Gerardo Roza',
        },
        items[0],
      ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
      {
        content:
          'Hi Alex. The next item is a proposal to invite Gerardo Roza as a member. Want to take a look?',
      },
    );
    expect(item?.slug).toBe('invite-member');
  });

  it('attaches the proposal in front of you when the reply points at the card', () => {
    const item = memberHomeThreadItemForMessage(items, {
      content:
        'I see that you have a proposal in front of you. You can now decide on the proposal card.',
    });
    expect(item?.slug).toBe('invite-member');
  });

  it('follows the person and the space when two proposals share a title', () => {
    const catalog = listMemberHomeThreadItems({
      ...home,
      proposals: [
        {
          ...home.proposals[0]!,
          creatorName: 'Gerardo Roza',
        },
        {
          ...home.proposals[0]!,
          id: 11,
          slug: 'invite-energy',
          spaceSlug: 'hypha-energy',
          spaceTitle: 'Hypha Energy',
          creatorName: 'Welime Haitsma',
          web3ProposalId: 42,
        },
      ],
    });
    const item = memberHomeThreadItemForMessage(catalog, {
      parts: [
        {
          type: 'text',
          text: 'The "Invite Member" proposal pertains to Welime Haitsma\'s request to join the Hypha Energy space. Welime is seeking to contribute to the collaborative efforts within the community.',
        },
        {
          type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
          state: 'output-available',
          input: { kind: 'proposal', slug: 'invite-member' },
        },
      ],
    });
    expect(item?.slug).toBe('invite-energy');
  });

  it('leaves a greeting with no item empty', () => {
    const item = memberHomeThreadItemForMessage(items, {
      parts: [
        {
          type: 'text',
          text: 'You are on your personal home screen. How can I assist you today?',
        },
      ],
    });
    expect(item).toBeNull();
  });
});

describe('shownMemberHomeItemKeys', () => {
  it('remembers which reply already carried a card', () => {
    const items = listMemberHomeThreadItems(home);
    const keys = shownMemberHomeItemKeys(items, [
      {
        role: 'assistant',
        parts: [
          {
            type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
            state: 'output-available',
            input: { kind: 'signal', slug: 'define-products' },
          },
        ],
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Invite Member' }],
      },
    ]);
    expect(keys).toEqual(['signal:define-products']);
  });
});

describe('passedMemberHomeItemKeys', () => {
  const items = listMemberHomeThreadItems(home);

  it('drops the offered item the first time the member refuses it', () => {
    const keys = passedMemberHomeItemKeys(items, [
      {
        role: 'assistant',
        parts: [
          {
            type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
            state: 'output-available',
            input: { kind: 'proposal', slug: 'invite-member' },
          },
        ],
      },
      {
        role: 'user',
        content: "I don't want to decide on it",
      },
      {
        role: 'assistant',
        content:
          "That's completely fine! If you need any assistance or want to explore something else, just let me know.",
      },
      {
        role: 'user',
        content: "I already told you I didn't want to decide on that",
      },
    ]);
    expect(keys).toEqual(['proposal:invite-member']);
  });

  it('keeps a later item when the member only refused the previous one', () => {
    const keys = passedMemberHomeItemKeys(items, [
      {
        role: 'assistant',
        parts: [
          {
            type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
            state: 'output-available',
            input: { kind: 'proposal', slug: 'invite-member' },
          },
        ],
      },
      { role: 'user', content: 'no' },
      {
        role: 'assistant',
        parts: [
          {
            type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
            state: 'output-available',
            input: { kind: 'signal', slug: 'define-products' },
          },
        ],
      },
      { role: 'user', content: 'yes' },
    ]);
    expect(keys).toEqual(['proposal:invite-member']);
  });

  it('keeps an item when the member asks for context', () => {
    const keys = passedMemberHomeItemKeys(items, [
      {
        role: 'assistant',
        parts: [
          {
            type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
            state: 'output-available',
            input: { kind: 'signal', slug: 'define-products' },
          },
        ],
      },
      {
        role: 'user',
        content:
          'Give me the context on Define products to be sold soon. Stay with this one and use the most recent discussion.',
      },
    ]);
    expect(keys).toEqual([]);
  });

  it('shows the proposal card when the reply names its author', () => {
    const catalog = listMemberHomeThreadItems({
      ...home,
      proposals: [
        {
          ...home.proposals[0]!,
          slug: 'april-contribution',
          title: 'Contribution April to June',
          creatorId: 4,
          creatorName: 'Ronnie Potel',
          description: 'Commitment level and compensation for April to June.',
        },
      ],
    });
    const item = memberHomeThreadItemForMessage(catalog, {
      content:
        "Here's the proposal from Ronnie Xerxes Potel regarding his contribution for the period from April to June. What would you like to decide about this proposal?",
    });
    expect(item?.slug).toBe('april-contribution');
  });

  it('drops the proposal they refused to look at, not the one already on the card', () => {
    const two = listMemberHomeThreadItems({
      ...home,
      proposals: [
        ...home.proposals,
        {
          ...home.proposals[0]!,
          id: 10,
          slug: 'join-services',
          title: 'Join Hypha Services',
          spaceSlug: 'hypha-services',
          spaceTitle: 'Hypha Services',
        },
      ],
    });
    const memory = memberHomeItemMemory(two, [
      {
        role: 'assistant',
        content:
          "I've approved the request to join Hypha Services. The next proposal is an invite for Hypha Pollinate. Want to take a look at that now?",
      },
      {
        role: 'user',
        content: "I don't want to look at this proposal",
      },
    ]);
    expect(memory.passed).toContain('proposal:invite-member');
    expect(memory.passed).not.toContain('proposal:join-services');
  });

  it('remembers not now and leaves the item after a second one', () => {
    const offer = {
      role: 'assistant' as const,
      parts: [
        {
          type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
          state: 'output-available',
          input: { kind: 'proposal', slug: 'invite-member' },
        },
      ],
    };
    const once = memberHomeItemMemory(items, [
      offer,
      { role: 'user', content: 'Not now for Invite Member.' },
    ]);
    expect(once.passed).toEqual([]);
    expect(once.deferred).toEqual(['proposal:invite-member']);
    expect(once.held).toBe('proposal:invite-member');

    const again = memberHomeItemMemory(items, [
      offer,
      { role: 'user', content: 'Not now for Invite Member.' },
      offer,
      { role: 'user', content: 'Not now for Invite Member.' },
    ]);
    expect(again.passed).toEqual(['proposal:invite-member']);
    expect(again.deferred).toEqual([]);
    expect(again.recalled).toEqual([]);
  });

  it('lets a later reply bring a not-now back once', () => {
    const offer = (slug: string, kind: 'proposal' | 'signal') => ({
      role: 'assistant' as const,
      parts: [
        {
          type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
          state: 'output-available',
          input: { kind, slug },
        },
      ],
    });
    const afterAnotherItem = memberHomeItemMemory(items, [
      offer('invite-member', 'proposal'),
      { role: 'user', content: 'Not now for Invite Member.' },
      offer('define-products', 'signal'),
      { role: 'user', content: "I'll help with Define products." },
    ]);
    expect(afterAnotherItem.held).toBeNull();
    expect(afterAnotherItem.deferred).toEqual(['proposal:invite-member']);
    expect(afterAnotherItem.passed).toEqual([]);

    const asked = memberHomeItemMemory(items, [
      offer('invite-member', 'proposal'),
      { role: 'user', content: 'Not now for Invite Member.' },
      offer('invite-member', 'proposal'),
    ]);
    expect(asked.deferred).toEqual([]);
    expect(asked.recalled).toEqual(['proposal:invite-member']);
    expect(asked.held).toBe('proposal:invite-member');

    const agreed = memberHomeItemMemory(items, [
      offer('invite-member', 'proposal'),
      { role: 'user', content: 'Not now for Invite Member.' },
      offer('invite-member', 'proposal'),
      { role: 'user', content: "I'll help with Invite Member." },
    ]);
    expect(agreed.settled).toEqual(['proposal:invite-member']);
    expect(agreed.deferred).toEqual([]);
    expect(agreed.recalled).toEqual([]);
    expect(agreed.passed).toEqual([]);
    expect(agreed.held).toBeNull();
  });
});

describe('memberHomeBoardDestination', () => {
  const spaces = [
    { slug: 'hypha-energy', title: 'Hypha Energy' },
    { slug: 'hypha-pollinate', title: 'Hypha Pollinate' },
  ];

  it('opens the signals board when they agree to look', () => {
    const destination = memberHomeBoardDestination({
      text: 'yes',
      previousAssistantText:
        'Would you like me to navigate you to the Hypha Energy space or the signals board?',
      spaces,
      lang: 'en',
    });
    expect(destination).toEqual({
      href: '/en/dho/hypha-energy/coherence',
      title: 'Hypha Energy',
    });
  });

  it('leaves a yes on a proposal on the card', () => {
    const destination = memberHomeBoardDestination({
      text: 'yes',
      previousAssistantText:
        'Gerardo Roza has asked to join Hypha Pollinate. You can now decide on the proposal card.',
      spaces,
      lang: 'en',
    });
    expect(destination).toBeNull();
  });

  it('replaces a recited signal list with the board', () => {
    const destination = memberHomeSignalCatalogue(
      "I've opened the Hypha Energy space for you! Here are some recent signals: 1. RoadMap page. 2. Social media. 3. Demo scenario.",
      spaces,
      'en',
    );
    expect(destination?.href).toBe('/en/dho/hypha-energy/coherence');
  });

  it('treats a numbered signal list as a catalogue', () => {
    const destination = memberHomeSignalCatalogue(
      'Hypha Energy\n1. RoadMap page\n2. Social media\n3. Demo scenario',
      spaces,
      'en',
    );
    expect(destination?.href).toBe('/en/dho/hypha-energy/coherence');
  });
});
