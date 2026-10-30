import { describe, expect, it } from 'vitest';

import type { MemberIntelligence } from '../member-intelligence';
import {
  SHOW_MEMBER_HOME_ITEM_TOOL,
  type MemberHomeThreadItem,
  listMemberHomeAttentionItems,
  listMemberHomeThreadCatalog,
  listMemberHomeThreadItems,
  listSpaceAttentionLead,
  memberHomeDirectReply,
  memberHomeTalkIsResting,
  mergeMemberHomeAttention,
  memberHomeBoardDestination,
  memberHomeItemsStillWaiting,
  memberHomeSignalAction,
  memberHomeSignalCatalogue,
  memberHomeSignalCtas,
  memberHomeCardForSpeech,
  memberHomeSpeechConflictsWithItem,
  memberHomeThreadItemForMessage,
  resolveMemberHomeThreadItem,
  memberHomeItemMemory,
  isMemberHomeItemLook,
  memberHomeLookItem,
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

  it('space needs-you prefers the next open item over a closed vote', () => {
    const closedVote = {
      ...home.proposals[0]!,
      spaceSlug: 'hypha-energy',
      spaceTitle: 'Hypha Energy',
      expired: true,
      outcome: { passed: true, participation: 50, unity: 100 },
    };
    expect(
      listSpaceAttentionLead(
        {
          ...home,
          proposals: [closedVote],
        },
        'hypha-energy',
      ),
    ).toMatchObject({ slug: 'define-products', action: 'validate' });
    expect(
      listSpaceAttentionLead(
        {
          ...home,
          attention: [],
          notifications: [],
          proposals: [closedVote],
          signals: [],
        },
        'hypha-energy',
      ),
    ).toBeNull();
  });

  it('space needs-you hides when only an accepted proposal remains', () => {
    expect(
      listSpaceAttentionLead(
        {
          ...home,
          attention: [],
          notifications: [],
          proposals: [
            {
              ...home.proposals[0]!,
              expired: true,
              outcome: { passed: true, participation: 50, unity: 100 },
            },
          ],
          signals: [],
        },
        'hypha-pollinate',
      ),
    ).toBeNull();
  });

  it('space needs-you hides done and cancelled signals', () => {
    expect(
      listSpaceAttentionLead(
        {
          ...home,
          attention: [],
          notifications: [],
          proposals: [],
          signals: [
            { ...home.signals[0]!, progressStatus: 'done' },
            {
              ...home.signals[0]!,
              id: 99,
              slug: 'cancelled-work',
              progressStatus: 'cancelled',
            },
          ],
        },
        'hypha-energy',
      ),
    ).toBeNull();
  });

  it('leaves done signals out of the waiting catalog', () => {
    const items = listMemberHomeThreadCatalog({
      ...home,
      signals: [{ ...home.signals[0]!, progressStatus: 'done' }],
      proposals: [],
    });
    expect(items.map((item) => item.slug)).toEqual([]);
  });

  it('leaves out a closed vote that has no recorded outcome', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      proposals: [{ ...home.proposals[0]!, expired: true }],
    });
    expect(items.map((item) => item.slug)).toEqual(['define-products']);
  });

  it('leaves out a withdrawn proposal even when the chain vote still looks open', () => {
    const items = listMemberHomeThreadItems({
      ...home,
      proposals: [{ ...home.proposals[0]!, withdrawn: true }],
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
    const closedHome = {
      ...home,
      proposals: [
        {
          ...home.proposals[0]!,
          expired: true,
          outcome: { passed: true, participation: 62, unity: 91 },
        },
      ],
    };
    // Focus walk drops closed votes so they are not "Needs you". The catalog
    // still keeps them for a confirmation brief.
    expect(
      listMemberHomeThreadItems(closedHome).find(
        (item) => item.slug === 'invite-member',
      ),
    ).toBeUndefined();
    const proposal = listMemberHomeThreadCatalog(closedHome).find(
      (item) => item.slug === 'invite-member',
    );
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

  it('places the card when the reply uses a dash and an accent the record does not', () => {
    const compensation = {
      ...home.proposals[0]!,
      id: 21,
      slug: 'aug-sep-compensation',
      title: 'August-September 2026 Compensation',
      creatorName: 'Zekeriya Aydın',
      spaceTitle: 'Hypha',
      spaceSlug: 'hypha',
    };
    const items = listMemberHomeThreadItems({
      ...home,
      proposals: [compensation],
    });
    const item = memberHomeThreadItemForMessage(items, {
      content:
        'Understood! The first proposal to consider is the Proposal — August–September 2026 Compensation by Zekeriya Aydin. You can now decide on this proposal. What do you think?',
    });
    expect(item?.slug).toBe('aug-sep-compensation');
  });

  it('accepts the title when the tool was given that instead of the slug', () => {
    const items = listMemberHomeThreadItems(home);
    const item = resolveMemberHomeThreadItem(items, {
      kind: 'proposal',
      slug: 'Invite Member',
    });
    expect(item?.slug).toBe('invite-member');
  });

  it('uses a given name and the space when the title is paraphrased', () => {
    const item = memberHomeThreadItemForMessage(
      [
        {
          kind: 'proposal',
          slug: 'candidate-review',
          title: 'Friday candidate slate',
          spaceSlug: 'hypha-energy',
          spaceTitle: 'Hypha Energy',
          action: 'decision',
          documentKind: 'proposal',
          authoredByMember: false,
          category: null,
          summary: null,
          creatorId: 4,
          creatorName: 'Marieke Post',
          creatorAvatarUrl: null,
        },
        {
          kind: 'proposal',
          slug: 'other-review',
          title: 'Another review',
          spaceSlug: 'hypha-pollinate',
          spaceTitle: 'Hypha Pollinate',
          action: 'decision',
          documentKind: 'proposal',
          authoredByMember: false,
          category: null,
          summary: null,
          creatorId: 5,
          creatorName: 'Marieke Other',
          creatorAvatarUrl: null,
        },
      ],
      {
        content:
          "It should be up now — Marieke's candidate review in Hypha Energy.",
      },
    );
    expect(item?.slug).toBe('candidate-review');
  });

  it('keeps the card when the reply names the person and the space, not the title', () => {
    const signal = (
      slug: string,
      creatorName: string,
      spaceTitle: string,
      summary: string,
    ): MemberHomeThreadItem => ({
      kind: 'signal',
      slug,
      title: slug,
      spaceSlug: spaceTitle.toLowerCase().replace(/\s+/g, '-'),
      spaceTitle,
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: false,
      category: null,
      summary,
      creatorId: null,
      creatorName,
      creatorAvatarUrl: null,
    });
    const flywheel = memberHomeThreadItemForMessage(
      [
        signal(
          'older-flywheel',
          'Vlad Hramtsov',
          'Hypha Flywheel',
          'Something already discussed.',
        ),
        signal(
          'community-meet',
          'Vlad Hramtsov',
          'Hypha Flywheel',
          'A signal the community can meet.',
        ),
        signal('hypha-only', 'Vlad Hramtsov', 'Hypha', 'A different space.'),
      ],
      {
        content:
          'Nice one, Alex. Vlad has something open in Hypha Flywheel — a signal the community can meet, and it would mean a lot if you stayed with it for a moment.',
      },
    );
    expect(flywheel?.slug).toBe('community-meet');

    const energy = memberHomeThreadItemForMessage(
      [
        signal(
          'surya-goal',
          'Surya Raman',
          'Hypha Energy',
          "L'objectif à définir.",
        ),
        signal(
          'philippe-note',
          'Philippe Martin',
          'Hypha Energy',
          'Another note.',
        ),
        signal('joachim-note', 'Joachim Berg', 'Hypha Energy', 'A third note.'),
      ],
      {
        content:
          "Bien joué, Alex. Surya en a ouvert une autre dans Hypha Energy — sa note sur l'objectif à définir, avec Philippe et Joachim qui y contribuent aussi.",
      },
    );
    expect(energy?.slug).toBe('surya-goal');
  });

  it('keeps the card on the person the sentence names when the tool is the item just finished', () => {
    const item = memberHomeThreadItemForMessage(
      [
        {
          kind: 'proposal',
          slug: 'studio-costs',
          title: 'Studio costs',
          spaceSlug: 'hypha',
          spaceTitle: 'Hypha',
          action: 'decision',
          documentKind: 'proposal',
          authoredByMember: false,
          category: null,
          summary: null,
          creatorId: 3,
          creatorName: 'Ronnie Hale',
          creatorAvatarUrl: null,
        },
        {
          kind: 'proposal',
          slug: 'invite-marco',
          title: 'Invite Member',
          spaceSlug: 'hypha-energy',
          spaceTitle: 'Hypha Energy',
          action: 'decision',
          documentKind: 'proposal',
          authoredByMember: false,
          category: 'invite',
          summary: null,
          creatorId: 8,
          creatorName: 'Marco Rossi',
          creatorAvatarUrl: null,
        },
      ],
      {
        parts: [
          {
            type: 'text',
            text: "Glad that's done, Alex. Now Marco in Hypha Energy has asked to join — the people already there are the ones who can welcome him, if it feels right to you.",
          },
          {
            type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
            state: 'output-available',
            input: { kind: 'proposal', slug: 'studio-costs' },
          },
        ],
      },
    );
    expect(item?.slug).toBe('invite-marco');
  });

  it('keeps the card on the space the reply names, not the hinted one', () => {
    const energy: MemberHomeThreadItem = {
      kind: 'proposal',
      slug: 'invite-oceane',
      title: 'Invite Member',
      spaceSlug: 'hypha-energy',
      spaceTitle: 'Hypha Energy',
      action: 'decision',
      documentKind: 'proposal',
      authoredByMember: false,
      category: 'invite',
      summary: 'Océane asked to join as a member.',
      creatorId: 12,
      creatorName: 'Océane Martin',
      creatorAvatarUrl: null,
    };
    const flywheel: MemberHomeThreadItem = {
      kind: 'proposal',
      slug: 'invite-edgar',
      title: 'Invite Member',
      spaceSlug: 'hypha-flywheel',
      spaceTitle: 'Hypha Flywheel',
      action: 'outcome',
      documentKind: 'proposal',
      authoredByMember: false,
      category: 'invite',
      summary: 'Edgar Kampers has just requested to join as a member.',
      creatorId: 9,
      creatorName: 'Edgar Kampers',
      creatorAvatarUrl: null,
    };
    const text =
      "Bien noté, Alex. Océane a demandé à rejoindre Hypha Energy comme membre — une invitation qu'on peut accueillir.";
    const message = {
      parts: [
        { type: 'text', text },
        {
          type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
          state: 'output-available',
          input: { kind: 'proposal', slug: 'invite-edgar' },
        },
      ],
    };
    expect(
      memberHomeThreadItemForMessage([energy, flywheel], message)?.slug,
    ).toBe('invite-oceane');
    expect(
      memberHomeCardForSpeech({
        items: [energy, flywheel],
        message,
        hinted: flywheel,
        spaceTitles: ['Hypha Energy', 'Hypha Flywheel', 'Hypha'],
      })?.slug,
    ).toBe('invite-oceane');
    expect(
      memberHomeCardForSpeech({
        items: [flywheel],
        message: { content: text },
        hinted: flywheel,
        spaceTitles: ['Hypha Energy', 'Hypha Flywheel'],
      }),
    ).toBeNull();
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

  it('keeps the member’s own card when the brief names someone inside the work', () => {
    const ownSignal: MemberHomeThreadItem = {
      kind: 'signal',
      slug: 'love-based-algorithm',
      title: 'Fear-based to love-based algorithm',
      spaceSlug: 'humai-education',
      spaceTitle: 'HUMAI+ Education & Lifelong Learning',
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: true,
      category: null,
      summary: 'Wendy brought IP into this space.',
      creatorId: 1,
      creatorName: 'Alex Prate',
      creatorAvatarUrl: null,
    };
    const text =
      "You raised it yourself, Alex, and it's about the fear-based to love-based algorithm Wendy has brought into HUMAI+ Education & Lifelong Learning.";
    expect(
      memberHomeSpeechConflictsWithItem(
        ownSignal,
        text,
        ['HUMAI+ Education & Lifelong Learning'],
        ['Wendy Example'],
      ),
    ).toBe(false);
    expect(
      memberHomeCardForSpeech({
        items: [ownSignal],
        message: { content: text },
        hinted: ownSignal,
        spaceTitles: ['HUMAI+ Education & Lifelong Learning'],
      })?.slug,
    ).toBe('love-based-algorithm');
  });

  it('does not keep a hinted card when the reply names another person and space', () => {
    const suzanaEnergy: MemberHomeThreadItem = {
      kind: 'signal',
      slug: 'suzana-tension',
      title: 'How decisions land',
      spaceSlug: 'hypha-energy',
      spaceTitle: 'Hypha Energy',
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: false,
      category: null,
      summary: 'A tension about how decisions land.',
      creatorId: 4,
      creatorName: 'Suzana Mota',
      creatorAvatarUrl: null,
    };
    const vladFlywheel: MemberHomeThreadItem = {
      kind: 'signal',
      slug: 'vlad-meet',
      title: 'Community meet',
      spaceSlug: 'hypha-flywheel',
      spaceTitle: 'Hypha Flywheel',
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: false,
      category: null,
      summary: 'A signal the community can meet.',
      creatorId: 2,
      creatorName: 'Vlad Hramtsov',
      creatorAvatarUrl: null,
    };
    const text =
      'Nice one, Alex. Vlad has something open in Hypha Flywheel — a signal the community can meet.';
    expect(
      memberHomeCardForSpeech({
        items: [suzanaEnergy, vladFlywheel],
        message: { content: text },
        hinted: suzanaEnergy,
        spaceTitles: ['Hypha Energy', 'Hypha Flywheel'],
      })?.slug,
    ).toBe('vlad-meet');
    // Wrong hint, right words, and the right item is not in the pool: no card.
    expect(
      memberHomeCardForSpeech({
        items: [vladFlywheel],
        message: {
          content:
            'Alex, Suzana is naming a tension in Hypha Energy about how decisions land.',
        },
        hinted: vladFlywheel,
        spaceTitles: ['Hypha Energy', 'Hypha Flywheel'],
      }),
    ).toBeNull();
  });

  it('never keeps a Flywheel invite under Bioregion signal speech about the same person', () => {
    const bioregionSignal: MemberHomeThreadItem = {
      kind: 'signal',
      slug: 'legumes-cagettes',
      title: 'Légumes et Cagettes Rebelles',
      spaceSlug: 'bioregion-bassin-annecien',
      spaceTitle: 'Biorégion du Bassin Annécien',
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: false,
      category: 'opportunity',
      summary:
        'Aider à distribuer des produits frais dans les cercles étudiants.',
      creatorId: 8,
      creatorName: 'Someone Else',
      creatorAvatarUrl: null,
    };
    const vladInvite: MemberHomeThreadItem = {
      kind: 'proposal',
      slug: 'invite-vlad-flywheel',
      title: 'Invite Member',
      spaceSlug: 'hypha-flywheel',
      spaceTitle: 'Hypha Flywheel',
      action: 'outcome',
      documentKind: 'proposal',
      authoredByMember: false,
      category: 'invite',
      summary: 'Vlad Hramtsov has just requested to join as a member!',
      creatorId: 2,
      creatorName: 'Vlad Hramtsov',
      creatorAvatarUrl: null,
      passed: true,
      participation: 0.5,
      unity: 1,
    };
    const text =
      "Alex, si tu veux te rendre utile autrement, Vlad porte un signal dans la Biorégion du Bassin Annécien : collaborer avec Légumes et Cagettes Rebelles pour aider à distribuer des produits frais dans les cercles étudiants. Dis-moi si ce fil te parle et je t'emmène aux signaux de cet espace.";
    const spaceTitles = [
      'Biorégion du Bassin Annécien',
      'Hypha Flywheel',
      'Hypha Platform',
    ];
    expect(
      memberHomeSpeechConflictsWithItem(vladInvite, text, spaceTitles, [
        vladInvite.creatorName,
        bioregionSignal.creatorName,
      ]),
    ).toBe(true);
    expect(
      memberHomeCardForSpeech({
        items: [bioregionSignal, vladInvite],
        message: {
          parts: [
            { type: 'text', text },
            {
              type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
              state: 'output-available',
              input: { kind: 'proposal', slug: 'invite-vlad-flywheel' },
            },
          ],
        },
        hinted: vladInvite,
        spaceTitles,
      })?.slug,
    ).toBe('legumes-cagettes');
    // Tool showed the invite, words are a signal in Bioregion, and that
    // signal is not in the pool: show nothing rather than the wrong card.
    expect(
      memberHomeCardForSpeech({
        items: [vladInvite],
        message: {
          parts: [
            { type: 'text', text },
            {
              type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
              state: 'output-available',
              input: { kind: 'proposal', slug: 'invite-vlad-flywheel' },
            },
          ],
        },
        hinted: vladInvite,
        spaceTitles,
      }),
    ).toBeNull();
  });

  it('does not keep a member-raised card under text that credits someone else', () => {
    const ownDesktop: MemberHomeThreadItem = {
      kind: 'signal',
      slug: 'hypha-desktop-app',
      title: 'Hypha Desktop App',
      spaceSlug: 'hypha-platform',
      spaceTitle: 'Hypha Platform',
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: true,
      category: 'opportunity',
      summary: 'What would be involved to RWA?',
      creatorId: 1,
      creatorName: 'Alex Prate',
      creatorAvatarUrl: null,
    };
    const edgarInvite: MemberHomeThreadItem = {
      kind: 'proposal',
      slug: 'invite-edgar',
      title: 'Invite Member',
      spaceSlug: 'hypha-platform',
      spaceTitle: 'Hypha Platform',
      action: 'decision',
      documentKind: 'proposal',
      authoredByMember: false,
      category: 'invite',
      summary: 'Edgar asked to join.',
      creatorId: 9,
      creatorName: 'Edgar Kampers',
      creatorAvatarUrl: null,
    };
    const text =
      "Edgar's thread in Hypha Platform is the one still open, Alex. He has put something on the table there about how the space's agreements are read and shared.";
    expect(
      memberHomeCardForSpeech({
        items: [ownDesktop, edgarInvite],
        message: {
          parts: [
            { type: 'text', text },
            {
              type: `tool-${SHOW_MEMBER_HOME_ITEM_TOOL}`,
              state: 'output-available',
              input: { kind: 'signal', slug: 'hypha-desktop-app' },
            },
          ],
        },
        hinted: ownDesktop,
        spaceTitles: ['Hypha Platform'],
      })?.slug,
    ).toBe('invite-edgar');
    expect(
      memberHomeCardForSpeech({
        items: [ownDesktop],
        message: { content: text },
        hinted: ownDesktop,
        spaceTitles: ['Hypha Platform'],
      }),
    ).toBeNull();
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

    const looking = memberHomeItemMemory(items, [
      offer('invite-member', 'proposal'),
      { role: 'user', content: 'Not now for Invite Member.' },
      offer('invite-member', 'proposal'),
      { role: 'user', content: 'Can you show me the proposal?' },
      { role: 'user', content: "I don't see." },
      { role: 'user', content: 'Yes, open the flywheel.' },
    ]);
    expect(looking.settled).toEqual([]);
    expect(looking.recalled).toEqual(['proposal:invite-member']);
    const broughtBack = [
      offer('invite-member', 'proposal'),
      { role: 'user' as const, content: 'Not now for Invite Member.' },
      offer('invite-member', 'proposal'),
    ];
    expect(
      memberHomeLookItem(items, broughtBack, 'Can you show me the proposal?')
        ?.slug,
    ).toBe('invite-member');
    expect(memberHomeLookItem(items, broughtBack, "I don't see.")?.slug).toBe(
      'invite-member',
    );
    const flywheel = {
      ...items.find((item) => item.kind === 'proposal')!,
      slug: 'join-flywheel',
      title: 'Invite to join',
      spaceSlug: 'hypha-flywheel',
      spaceTitle: 'Hypha Flywheel',
    };
    expect(
      memberHomeLookItem([flywheel], [], 'Yes, open the flywheel.')?.slug,
    ).toBe('join-flywheel');
    expect(
      memberHomeLookItem(items, broughtBack, 'Tell me about the budget'),
    ).toBeNull();
  });

  it('show brings back the card from the reply above', () => {
    expect(isMemberHomeItemLook('show')).toBe(true);
    expect(isMemberHomeItemLook('montre')).toBe(true);
    expect(isMemberHomeItemLook('Tell me about the budget')).toBe(false);
    const surya: MemberHomeThreadItem = {
      kind: 'signal',
      slug: 'surya-goal',
      title: 'Objectif à définir',
      spaceSlug: 'hypha-energy',
      spaceTitle: 'Hypha Energy',
      action: 'validate',
      documentKind: 'signal',
      authoredByMember: false,
      category: null,
      summary: "L'objectif à définir.",
      creatorId: 4,
      creatorName: 'Surya Raman',
      creatorAvatarUrl: null,
    };
    const zekeriya: MemberHomeThreadItem = {
      ...surya,
      slug: 'tariff-table',
      title: 'Tariff table related with country and customer',
      summary: 'Same tariff for everyone.',
      creatorId: 5,
      creatorName: 'Zekeriya Aydin',
    };
    const previous = {
      role: 'assistant' as const,
      content:
        "Bien joué, Alex. Surya en a ouvert une autre dans Hypha Energy — sa note sur l'objectif à définir, avec Philippe et Joachim qui y contribuent aussi.",
    };
    expect(
      memberHomeLookItem([surya, zekeriya], [previous], 'show')?.slug,
    ).toBe('surya-goal');
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

describe('memberHomeDirectReply', () => {
  it('names the open decision instead of an empty queue', () => {
    const reply = memberHomeDirectReply(home, 'What needs a decision?');
    expect(reply).toMatchObject({
      ask: 'decision',
      widget: null,
      item: { kind: 'proposal', slug: 'invite-member' },
      line: {
        key: 'decisionOpen',
        title: 'Invite Member',
        space: 'Hypha Pollinate',
      },
    });
  });

  it('names the notification when that decision is not waiting on a vote', () => {
    const reply = memberHomeDirectReply(
      {
        ...home,
        proposals: [{ ...home.proposals[0]!, memberHasVoted: true }],
        attention: [],
        notifications: [
          {
            id: 'proposal-9',
            kind: 'proposal',
            title: 'Invite Member',
            detail: 'Live Earth Pitch · a decision',
            spaceSlug: 'live-earth-pitch',
            spaceTitle: 'Live Earth Pitch',
            targetSlug: 'invite-member',
            at: '2026-10-27T00:00:00.000Z',
          },
        ],
      },
      'What needs a decision?',
    );
    expect(reply?.line).toEqual({
      key: 'decisionListed',
      title: 'Invite Member',
      space: 'Live Earth Pitch',
    });
    expect(reply?.item).toEqual({
      kind: 'proposal',
      slug: 'invite-member',
    });
  });

  it('keeps who is around on the people list', () => {
    const reply = memberHomeDirectReply(
      {
        ...home,
        connections: [
          {
            id: 2,
            slug: 'vlad',
            name: 'Vlad',
            surname: 'Hramtsov',
            nickname: null,
            avatarUrl: null,
            sharedSpaceCount: 12,
          },
          {
            id: 3,
            slug: 'edgar',
            name: 'Edgar',
            surname: 'Kampers',
            nickname: null,
            avatarUrl: null,
            sharedSpaceCount: 4,
          },
        ],
      },
      'Who is around?',
    );
    expect(reply).toMatchObject({
      ask: 'people',
      widget: 'people',
      item: null,
      line: { key: 'people', name: 'Vlad Hramtsov', count: 12 },
    });
  });

  it('names a space that is actually on the list', () => {
    const reply = memberHomeDirectReply(
      {
        ...home,
        spaces: [
          {
            id: 1,
            slug: 'commercial-energy-hub',
            title: 'Commercial Energy Hub',
            description: '',
            logoUrl: null,
          },
          {
            id: 2,
            slug: 'hypha-platform',
            title: 'Hypha Platform',
            description: '',
            logoUrl: null,
          },
        ],
      },
      'Step into a space',
      { recentSpaceSlugs: ['hypha-platform'] },
    );
    expect(reply).toMatchObject({
      widget: 'spaces',
      line: { key: 'space', space: 'Hypha Platform' },
    });
  });

  it('offers tokens only for the token chip', () => {
    const reply = memberHomeDirectReply(
      {
        ...home,
        connections: [
          {
            id: 2,
            slug: 'vlad',
            name: 'Vlad',
            surname: null,
            nickname: null,
            avatarUrl: null,
            sharedSpaceCount: 3,
          },
        ],
      },
      'Send someone tokens',
    );
    expect(reply).toMatchObject({
      ask: 'tokens',
      widget: 'tokens',
      line: { key: 'tokens', name: 'Vlad' },
    });
  });

  it('leaves arrival and where they can be useful to the conversation', () => {
    expect(memberHomeDirectReply(home, 'I am on my home.')).toBeNull();
    expect(memberHomeDirectReply(home, 'Where can I be useful?')).toBeNull();
  });

  it('leaves an ordinary message to the model', () => {
    expect(memberHomeDirectReply(home, 'Tell me about the budget')).toBeNull();
  });
});

describe('memberHomeTalkIsResting', () => {
  it('keeps going until they stop or accept a pause', () => {
    expect(
      memberHomeTalkIsResting([
        { role: 'assistant', content: 'Alex, Marco has asked to join.' },
        { role: 'user', content: 'Where can I be useful?' },
      ]),
    ).toBe(false);
    expect(
      memberHomeTalkIsResting([
        { role: 'assistant', content: 'Alex, Marco has asked to join.' },
        { role: 'user', content: 'Stop' },
      ]),
    ).toBe(true);
    expect(
      memberHomeTalkIsResting([
        {
          role: 'assistant',
          content:
            'Would you like to pause for now, or continue going through what still needs you?',
        },
        { role: 'user', content: 'Yes' },
      ]),
    ).toBe(true);
    expect(
      memberHomeTalkIsResting([
        {
          role: 'assistant',
          content:
            'Would you like to pause for now, or continue going through what still needs you?',
        },
        { role: 'user', content: 'Continue' },
      ]),
    ).toBe(false);
    expect(
      memberHomeTalkIsResting([
        { role: 'assistant', content: 'Alex, Marco has asked to join.' },
        { role: 'user', content: 'Stop' },
        { role: 'user', content: 'Where can I be useful?' },
      ]),
    ).toBe(false);
    expect(
      memberHomeTalkIsResting([
        {
          role: 'user',
          content: 'I am on my home.',
          metadata: { homeArrival: true },
        },
        { role: 'assistant', content: 'Alex, Marco has asked to join.' },
      ]),
    ).toBe(false);
  });
});
