import { describe, expect, it } from 'vitest';

import {
  mergeMemberSpaces,
  peerNamesByPerson,
  peopleSharingMemberSpaces,
  pickNotificationsAcrossSpaces,
} from '../../member-intelligence';
import { SPACE_ACTOR_SUB_PREFIX } from '../space-actor-person';
import {
  buildMemberGuidance,
  parseMemberOrientation,
} from '../../member-intelligence-guidance';

describe('mergeMemberSpaces', () => {
  it('keeps on-chain spaces when the memberships table has none', () => {
    expect(
      mergeMemberSpaces(
        [
          {
            id: 4,
            slug: 'hypha',
            title: 'Hypha',
            description: null,
            logoUrl: null,
          },
        ],
        [],
      ).map((space) => space.slug),
    ).toEqual(['hypha']);
  });

  it('appends database rows that are not already on chain', () => {
    const chain = {
      id: 4,
      slug: 'hypha',
      title: 'Hypha',
      description: null,
      logoUrl: null,
    };
    const onlyInDb = {
      id: 9,
      slug: 'local',
      title: 'Local',
      description: null,
      logoUrl: null,
    };
    expect(
      mergeMemberSpaces([chain], [chain, onlyInDb]).map((space) => space.id),
    ).toEqual([4, 9]);
  });
});

describe('parseMemberOrientation', () => {
  it('keeps the three orientations and treats anything else as unset', () => {
    expect(parseMemberOrientation('member')).toBe('member');
    expect(parseMemberOrientation('builder')).toBe('builder');
    expect(parseMemberOrientation('investor')).toBe('investor');
    expect(parseMemberOrientation(null)).toBeNull();
    expect(parseMemberOrientation('guest')).toBeNull();
  });
});

describe('buildMemberGuidance', () => {
  it('points at the first decision that needs the member', () => {
    expect(
      buildMemberGuidance({
        firstName: 'Alex',
        orientation: 'member',
        spaceCount: 2,
        attention: {
          kind: 'proposal',
          title: 'Fund the winter greenhouse',
          spaceTitle: 'Noord Food Commons',
        },
      }),
    ).toBe(
      'Hi Alex. Fund the winter greenhouse in Noord Food Commons is open for a vote. The choice stays with you.',
    );
  });

  it('names the latest discussion instead of handing the choice back', () => {
    expect(
      buildMemberGuidance({
        firstName: 'Alex',
        orientation: 'member',
        spaceCount: 2,
        attention: {
          kind: 'proposal',
          title: 'Winter notes',
          spaceTitle: 'Hypha Energy',
          documentState: 'discussion',
          creatorName: 'Sara',
        },
      }),
    ).toBe(
      'Hi Alex. The latest discussion is Winter notes in Hypha Energy. Sara opened it. Ready to take a look?',
    );
  });

  it('invites a builder with no spaces to shape one', () => {
    expect(
      buildMemberGuidance({
        firstName: 'Alex',
        orientation: 'builder',
        spaceCount: 0,
        attention: null,
      }),
    ).toContain('shape a space');
  });

  it('offers activation or the network when nothing needs the member', () => {
    expect(
      buildMemberGuidance({
        firstName: 'Alex',
        orientation: 'investor',
        spaceCount: 3,
        attention: null,
      }),
    ).toBe(
      'Hi Alex. Activate a space you are in, or open your horizon and listen to the network.',
    );
  });
});

describe('peopleSharingMemberSpaces', () => {
  const people = [
    {
      id: 1,
      slug: 'alex',
      name: 'Alex',
      surname: null,
      nickname: null,
      avatarUrl: null,
      address: '0xAAAA',
      sub: 'did:privy:alex',
    },
    {
      id: 2,
      slug: 'sam',
      name: 'Sam',
      surname: null,
      nickname: null,
      avatarUrl: null,
      address: '0xbbbb',
      sub: 'did:privy:sam',
    },
    {
      id: 3,
      slug: 'noor',
      name: 'Noor',
      surname: null,
      nickname: null,
      avatarUrl: null,
      address: '0xCCCC',
      sub: null,
    },
    {
      id: 4,
      slug: 'space-hypha',
      name: 'Hypha',
      surname: null,
      nickname: null,
      avatarUrl: null,
      address: '0xDDDD',
      sub: `${SPACE_ACTOR_SUB_PREFIX}9`,
    },
  ];

  it('counts other people who share the caller spaces and leaves the caller out', () => {
    const result = peopleSharingMemberSpaces({
      callerPersonId: 1,
      membersBySpace: [
        { spaceId: 10, addresses: ['0xaaaa', '0xBBBB', '0xcccc'] },
        { spaceId: 11, addresses: ['0xAAAA', '0xbbbb'] },
      ],
      people,
      spaceActorSubPrefix: SPACE_ACTOR_SUB_PREFIX,
      limit: 6,
    });

    expect(result.count).toBe(2);
    expect(result.connections.map((person) => person.id)).toEqual([2, 3]);
    expect(result.connections[0]?.sharedSpaceCount).toBe(2);
    expect(result.connections[0]?.address).toBe('0xbbbb');
    expect(result.connections[1]?.sharedSpaceCount).toBe(1);
    expect(result.connections[1]?.address).toBe('0xCCCC');
  });

  it('names the people a creator shares a space with', () => {
    const peers = peerNamesByPerson({
      callerPersonId: 1,
      membersBySpace: [
        { spaceId: 10, addresses: ['0xaaaa', '0xBBBB', '0xcccc'] },
        { spaceId: 11, addresses: ['0xAAAA', '0xbbbb'] },
      ],
      people,
      spaceActorSubPrefix: SPACE_ACTOR_SUB_PREFIX,
      focusPersonIds: [2],
      limit: 4,
    });

    expect(peers.get(2)).toEqual(['Noor']);
    expect(peers.has(1)).toBe(false);
    expect(peers.has(4)).toBe(false);
  });

  it('stays at zero when the caller is in no spaces', () => {
    expect(
      peopleSharingMemberSpaces({
        callerPersonId: 1,
        membersBySpace: [],
        people,
        spaceActorSubPrefix: SPACE_ACTOR_SUB_PREFIX,
        limit: 6,
      }),
    ).toEqual({ count: 0, connections: [] });
  });

  it('does not count space-actor profiles', () => {
    const result = peopleSharingMemberSpaces({
      callerPersonId: 1,
      membersBySpace: [{ spaceId: 10, addresses: ['0xaaaa', '0xdddd'] }],
      people,
      spaceActorSubPrefix: SPACE_ACTOR_SUB_PREFIX,
      limit: 6,
    });

    expect(result.count).toBe(0);
    expect(result.connections).toEqual([]);
  });
});

describe('pickNotificationsAcrossSpaces', () => {
  it('keeps one item from each space before a second item from a busy space', () => {
    const picked = pickNotificationsAcrossSpaces(
      [
        {
          id: 'proposal-1',
          kind: 'proposal',
          title: 'Newer in Hypha',
          detail: 'Hypha',
          spaceSlug: 'hypha',
          spaceTitle: 'Hypha',
          targetSlug: 'newer',
          at: '2026-10-09T12:00:00.000Z',
        },
        {
          id: 'proposal-2',
          kind: 'proposal',
          title: 'Older in Hypha',
          detail: 'Hypha',
          spaceSlug: 'hypha',
          spaceTitle: 'Hypha',
          targetSlug: 'older',
          at: '2026-10-08T12:00:00.000Z',
        },
        {
          id: 'signal-3',
          kind: 'signal',
          title: 'Noord signal',
          detail: 'Noord',
          spaceSlug: 'noord',
          spaceTitle: 'Noord',
          targetSlug: 'signal',
          at: '2026-10-07T12:00:00.000Z',
        },
      ],
      2,
    );

    expect(picked.map((item) => item.id)).toEqual(['proposal-1', 'signal-3']);
  });
});
