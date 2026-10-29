import { describe, expect, it } from 'vitest';

import {
  aliasLocalpart,
  channelDisplayName,
  channelHasRecentActivity,
  channelIsRelevantToMember,
  channelRowsFromSnapshots,
  inboxContextHref,
  inboxContextLine,
  inboxFilterCounts,
  inboxListWindow,
  INBOX_LIST_PAGE,
  inboxKindForRoomType,
  isInboxChannelKind,
  resolveInboxPlace,
  rowMatchesInboxFilter,
  type InboxContext,
} from '../messages-inbox';

const context: InboxContext = {
  spaces: [
    {
      id: 2,
      slug: 'hypha-platform',
      title: 'Hypha Platform',
      parentId: 1,
      chatRoomId: '!space:hs',
      rootSlug: 'hypha',
      rootTitle: 'Hypha',
    },
  ],
  signals: [
    {
      roomId: '!signal:hs',
      title: 'Roadmap page',
      type: 'Need',
      slug: 'roadmap-page',
      spaceSlug: 'hypha-platform',
      spaceTitle: 'Hypha Platform',
      rootSlug: 'hypha',
      rootTitle: 'Hypha',
      notified: true,
    },
  ],
};

const now = new Date('2026-10-27T12:00:00Z').getTime();
const recent = new Date('2026-09-01T12:00:00Z').getTime();
const quiet = new Date('2026-06-01T12:00:00Z').getTime();

describe('messages inbox filters', () => {
  it('keeps direct chats out of space, ecosystem, and network filters', () => {
    expect(rowMatchesInboxFilter('dm', 'direct')).toBe(true);
    expect(rowMatchesInboxFilter('group', 'direct')).toBe(true);
    expect(rowMatchesInboxFilter('dm', 'spaces')).toBe(false);
    expect(rowMatchesInboxFilter('group', 'network')).toBe(false);
    expect(rowMatchesInboxFilter('space', 'rooms')).toBe(true);
    expect(rowMatchesInboxFilter('space-public', 'rooms')).toBe(true);
    expect(rowMatchesInboxFilter('signal', 'rooms')).toBe(false);
    expect(rowMatchesInboxFilter('signal', 'signals')).toBe(true);
    expect(rowMatchesInboxFilter('signal', 'spaces')).toBe(true);
    expect(rowMatchesInboxFilter('proposal', 'proposals')).toBe(true);
    expect(rowMatchesInboxFilter('proposal', 'rooms')).toBe(false);
    expect(rowMatchesInboxFilter('proposal', 'signals')).toBe(false);
    expect(rowMatchesInboxFilter('proposal', 'spaces')).toBe(true);
    expect(rowMatchesInboxFilter('ecosystem', 'ecosystem')).toBe(true);
    expect(rowMatchesInboxFilter('network', 'network')).toBe(true);
    expect(rowMatchesInboxFilter('space', 'all')).toBe(true);
  });

  it('treats proposal rooms as their own messages channel', () => {
    expect(inboxKindForRoomType('io.hypha.room.proposal')).toBe('proposal');
    expect(
      isInboxChannelKind(inboxKindForRoomType('io.hypha.room.proposal')),
    ).toBe(true);
    expect(
      isInboxChannelKind(inboxKindForRoomType('io.hypha.room.space')),
    ).toBe(true);
    expect(isInboxChannelKind('dm')).toBe(false);
  });

  it('counts each conversation once per matching filter', () => {
    const counts = inboxFilterCounts([
      { kind: 'dm', unread: 2 },
      { kind: 'signal', unread: 1 },
      { kind: 'network', unread: 0 },
    ]);
    expect(counts.all).toEqual({ total: 3, unread: 3 });
    expect(counts.direct).toEqual({ total: 1, unread: 2 });
    expect(counts.signals).toEqual({ total: 1, unread: 1 });
    expect(counts.spaces).toEqual({ total: 1, unread: 1 });
    expect(counts.network).toEqual({ total: 1, unread: 0 });
  });

  it('keeps unread totals when the painted list is only the first screen', () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      kind: 'dm' as const,
      unread: index === 0 || index === 14 ? 3 : 0,
    }));
    const counts = inboxFilterCounts(rows);
    const page = inboxListWindow(rows, INBOX_LIST_PAGE);
    expect(page.rows).toHaveLength(INBOX_LIST_PAGE);
    expect(page.hasMore).toBe(true);
    expect(counts.all.unread).toBe(6);
    expect(inboxFilterCounts(page.rows).all.unread).toBe(3);
  });
});

describe('messages inbox context', () => {
  it('reads the space and ecosystem from aliases that already exist', () => {
    expect(aliasLocalpart('#hypha-public-hypha-platform:example.org')).toBe(
      'hypha-public-hypha-platform',
    );
    const place = resolveInboxPlace(
      {
        roomId: '!public:hs',
        roomType: 'io.hypha.room.space-public',
        aliases: ['#hypha-public-hypha-platform:example.org'],
      },
      context,
    );
    expect(place).toMatchObject({
      kind: 'space-public',
      spaceTitle: 'Hypha Platform',
      ecosystemTitle: 'Hypha',
    });
    expect(inboxContextLine(place!, null)).toBe('Hypha Platform · Hypha');
  });

  it('names the signal, its type, the space, and the ecosystem root', () => {
    const place = resolveInboxPlace(
      {
        roomId: '!signal:hs',
        roomType: 'io.hypha.room.signal',
        aliases: [],
      },
      context,
    );
    expect(place?.signalTitle).toBe('Roadmap page');
    expect(inboxContextLine(place!, 'Need')).toBe(
      'Need · Hypha Platform · Hypha',
    );
    expect(
      channelDisplayName({ name: 'old room name' }, place!, 'Network'),
    ).toBe('Roadmap page');
  });

  it('builds a row from the existing room id when the member is notified and the channel is active', () => {
    const [row] = channelRowsFromSnapshots(
      [
        {
          roomId: '!signal:hs',
          roomType: 'io.hypha.room.signal',
          name: 'old room name',
          aliases: [],
          preview: 'hello',
          mine: false,
          lastTs: recent,
          unread: 1,
        },
      ],
      context,
      'Network',
      now,
    );
    expect(row?.roomId).toBe('!signal:hs');
    expect(row?.name).toBe('Roadmap page');
    expect(row?.inbox.kind).toBe('signal');
    expect(row?.person.id).toBeLessThan(0);
  });

  it('shows a proposal chat only to a member who can vote on it', () => {
    const voting = {
      ...context,
      proposals: [
        {
          roomId: '!proposal:hs',
          title: 'Garden vote',
          slug: 'garden-vote',
          spaceSlug: 'hypha-platform',
          spaceTitle: 'Hypha Platform',
          rootSlug: 'hypha',
          rootTitle: 'Hypha',
        },
        {
          roomId: '!quiet:hs',
          title: 'Quiet vote',
          slug: 'quiet-vote',
          spaceSlug: 'hypha-platform',
          spaceTitle: 'Hypha Platform',
          rootSlug: 'hypha',
          rootTitle: 'Hypha',
        },
      ],
    };
    const rows = channelRowsFromSnapshots(
      [
        {
          roomId: '!proposal:hs',
          roomType: 'io.hypha.room.proposal',
          name: 'old room name',
          aliases: [],
          preview: 'please vote',
          mine: false,
          lastTs: recent,
          unread: 1,
        },
        {
          roomId: '!quiet:hs',
          roomType: 'io.hypha.room.proposal',
          name: 'Quiet',
          aliases: [],
          preview: '',
          mine: false,
          lastTs: recent,
          unread: 0,
        },
        {
          roomId: '!other:hs',
          roomType: 'io.hypha.room.proposal',
          name: 'Other',
          aliases: [],
          preview: 'hidden',
          mine: false,
          lastTs: recent,
          unread: 0,
        },
      ],
      voting,
      'Network',
      now,
    );
    expect(rows.map((row) => row.roomId)).toEqual(['!proposal:hs']);
    expect(rows[0]?.name).toBe('Garden vote');
    expect(inboxContextHref('en', rows[0]?.inbox)).toBe(
      '/en/dho/hypha-platform/agreements/proposal/garden-vote',
    );
    expect(inboxContextLine(rows[0]!.inbox, null)).toBe(
      'Hypha Platform · Hypha',
    );
  });

  it('hides proposal chats that still have no messages', () => {
    const voting = {
      ...context,
      proposals: [
        {
          roomId: '!empty:hs',
          title: 'Invite Member',
          slug: 'invite-member',
          spaceSlug: 'hypha-platform',
          spaceTitle: 'Hypha Platform',
          rootSlug: 'hypha',
          rootTitle: 'Hypha',
        },
      ],
    };
    const rows = channelRowsFromSnapshots(
      [
        {
          roomId: '!empty:hs',
          roomType: 'io.hypha.room.proposal',
          name: 'Invite Member',
          aliases: [],
          preview: '',
          mine: false,
          lastTs: recent,
          unread: 0,
        },
      ],
      voting,
      'Network',
      now,
    );
    expect(rows).toEqual([]);
  });

  it('hides a signal the member is not on and has not been notified about', () => {
    const quietContext = {
      ...context,
      signals: [{ ...context.signals[0]!, notified: false }],
    };
    const rows = channelRowsFromSnapshots(
      [
        {
          roomId: '!signal:hs',
          roomType: 'io.hypha.room.signal',
          name: 'Roadmap page',
          aliases: [],
          preview: 'hello',
          mine: false,
          lastTs: recent,
          unread: 0,
        },
      ],
      quietContext,
      'Network',
      now,
    );
    expect(rows).toEqual([]);
  });

  it('keeps a signal when the member is on the team, even if they are not an assignee', () => {
    const quietContext = {
      ...context,
      signals: [{ ...context.signals[0]!, notified: false }],
    };
    const [row] = channelRowsFromSnapshots(
      [
        {
          roomId: '!signal:hs',
          roomType: 'io.hypha.room.signal',
          name: 'Roadmap page',
          aliases: [],
          preview: 'hello',
          mine: false,
          lastTs: recent,
          unread: 0,
          onSignalTeam: true,
        },
      ],
      quietContext,
      'Network',
      now,
    );
    expect(row?.name).toBe('Roadmap page');
    expect(
      channelIsRelevantToMember(
        { roomId: '!signal:hs', onSignalTeam: true },
        row!.inbox,
        quietContext,
      ),
    ).toBe(true);
  });

  it('shows a member space and its ecosystem, and hides quiet or unrelated channels', () => {
    expect(channelHasRecentActivity(recent, now)).toBe(true);
    expect(channelHasRecentActivity(quiet, now)).toBe(false);
    expect(channelHasRecentActivity(null, now)).toBe(false);
    const rows = channelRowsFromSnapshots(
      [
        {
          roomId: '!space:hs',
          roomType: 'io.hypha.room.space',
          name: 'Hypha Platform',
          aliases: [],
          preview: 'hello',
          mine: false,
          lastTs: recent,
          unread: 2,
        },
        {
          roomId: '!other:hs',
          roomType: 'io.hypha.room.space',
          name: 'Somewhere else',
          aliases: [],
          preview: 'hello',
          mine: false,
          lastTs: recent,
          unread: 0,
        },
        {
          roomId: '!quiet:hs',
          roomType: 'io.hypha.room.space',
          name: 'Hypha Platform',
          aliases: [],
          preview: '',
          mine: false,
          lastTs: quiet,
          unread: 0,
        },
        {
          roomId: '!public:hs',
          roomType: 'io.hypha.room.space-public',
          name: 'Elsewhere',
          aliases: ['#hypha-public-elsewhere:example.org'],
          preview: 'hello',
          mine: false,
          lastTs: recent,
          unread: 0,
        },
        {
          roomId: '!eco:hs',
          roomType: 'io.hypha.room.ecosystem',
          name: 'Hypha',
          aliases: ['#hypha-ecosystem-hypha:example.org'],
          preview: 'across spaces',
          mine: false,
          lastTs: recent,
          unread: 0,
        },
        {
          roomId: '!net:hs',
          roomType: 'io.hypha.room.network',
          name: 'Network',
          aliases: ['#hypha-network:example.org'],
          preview: 'announcement',
          mine: false,
          lastTs: recent,
          unread: 1,
        },
      ],
      context,
      'Network',
      now,
    );
    expect(rows.map((row) => row.roomId)).toEqual([
      '!space:hs',
      '!other:hs',
      '!eco:hs',
      '!net:hs',
    ]);
  });

  it('keeps a signal you are notified about even when the room has been quiet', () => {
    const [row] = channelRowsFromSnapshots(
      [
        {
          roomId: '!signal:hs',
          roomType: 'io.hypha.room.signal',
          name: 'Roadmap page',
          aliases: [],
          preview: '',
          mine: false,
          lastTs: quiet,
          unread: 0,
        },
      ],
      context,
      'Network',
      now,
    );
    expect(row?.roomId).toBe('!signal:hs');
  });

  it('shows the network channel for everyone when it has a recent message', () => {
    const rows = channelRowsFromSnapshots(
      [
        {
          roomId: '!net:hs',
          roomType: 'io.hypha.room.network',
          name: 'Network',
          aliases: ['#hypha-network:example.org'],
          preview: 'announcement',
          mine: false,
          lastTs: recent,
          unread: 1,
        },
        {
          roomId: '!quiet-net:hs',
          roomType: 'io.hypha.room.network',
          name: 'Network',
          aliases: ['#hypha-network:example.org'],
          preview: '',
          mine: false,
          lastTs: quiet,
          unread: 0,
        },
      ],
      { spaces: [], signals: [] },
      'Network',
      now,
    );
    expect(rows.map((row) => row.roomId)).toEqual(['!net:hs']);
  });

  it('shows a Hypha room, its ecosystem, and the network when they were created before room types', () => {
    const hypha: InboxContext = {
      spaces: [
        ...context.spaces,
        {
          id: 1,
          slug: 'hypha',
          title: 'Hypha',
          parentId: null,
          chatRoomId: '!hypha-space:hs',
          rootSlug: 'hypha',
          rootTitle: 'Hypha',
        },
      ],
      signals: context.signals,
    };
    const rows = channelRowsFromSnapshots(
      [
        {
          roomId: '!hypha-space:hs',
          roomType: '',
          name: 'Hypha',
          aliases: [],
          preview: 'from Gerardo',
          mine: false,
          lastTs: recent,
          unread: 2,
        },
        {
          roomId: '!eco:hs',
          roomType: '',
          name: 'Ecosystem',
          aliases: ['#hypha-ecosystem-hypha:example.org'],
          preview: 'across spaces',
          mine: false,
          lastTs: recent,
          unread: 0,
        },
        {
          roomId: '!net:hs',
          roomType: '',
          name: 'Network',
          aliases: ['#hypha-network:example.org'],
          preview: 'announcement',
          mine: false,
          lastTs: recent,
          unread: 1,
        },
        {
          roomId: '!dm:hs',
          roomType: 'io.hypha.room.dm',
          name: 'Gerardo',
          aliases: ['#hypha-network:example.org'],
          preview: 'hello',
          mine: false,
          lastTs: recent,
          unread: 0,
        },
      ],
      hypha,
      'Network',
      now,
    );
    expect(rows.map((row) => [row.roomId, row.inbox.kind])).toEqual([
      ['!hypha-space:hs', 'space'],
      ['!eco:hs', 'ecosystem'],
      ['!net:hs', 'network'],
    ]);
  });
});

describe('inboxContextHref', () => {
  const place = {
    spaceTitle: 'Hypha Platform',
    spaceSlug: 'hypha-platform',
    ecosystemTitle: 'Hypha',
    ecosystemSlug: 'hypha',
    signalTitle: 'Roadmap page',
    signalType: 'Need',
    signalSlug: 'roadmap-page',
    proposalTitle: 'Garden vote',
    proposalSlug: 'garden-vote',
  };

  it('opens a signal, a space room, an ecosystem the member can enter, and the network', () => {
    expect(inboxContextHref('en', { ...place, kind: 'signal' })).toBe(
      '/en/dho/hypha-platform/coherence?signal=roadmap-page',
    );
    expect(inboxContextHref('en', { ...place, kind: 'space' })).toBe(
      '/en/dho/hypha-platform/overview?spaceChat=space',
    );
    expect(inboxContextHref('en', { ...place, kind: 'space-public' })).toBe(
      '/en/dho/hypha-platform/overview?spaceChat=public',
    );
    expect(inboxContextHref('en', { ...place, kind: 'ecosystem' })).toBe(
      '/en/dho/hypha-platform/overview?spaceChat=ecosystem',
    );
    expect(
      inboxContextHref('en', {
        ...place,
        kind: 'network',
        spaceSlug: null,
        ecosystemSlug: null,
      }),
    ).toBe('/en/network');
    expect(inboxContextHref('en', { ...place, kind: 'proposal' })).toBe(
      '/en/dho/hypha-platform/agreements/proposal/garden-vote',
    );
  });

  it('leaves direct chats in the inbox', () => {
    expect(inboxContextHref('en', { ...place, kind: 'dm' })).toBeNull();
  });
});
