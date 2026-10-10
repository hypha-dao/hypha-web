import { describe, expect, it } from 'vitest';

import type { MemberIntelligence } from '../member-intelligence';
import {
  SHOW_MEMBER_HOME_ITEM_TOOL,
  listMemberHomeThreadItems,
  memberHomeSignalAction,
  memberHomeSignalCtas,
  memberHomeThreadItemForMessage,
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
      web3ProposalId: null,
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

  it('leads with the most recent discussion', () => {
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
    expect(items.map((item) => item.slug)[0]).toBe('winter-notes');
    expect(items[0]?.documentKind).toBe('discussion');
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
});
