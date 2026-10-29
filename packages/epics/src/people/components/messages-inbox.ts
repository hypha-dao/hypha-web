/**
 * How an existing conversation is shown on Messages.
 * Kinds follow `m.room.create` types when those exist. Rooms created before
 * that type was written are still recognized from their alias, or from the
 * space and signal room ids already stored. This module does not create
 * rooms or change those types.
 */
export type InboxChannelKind =
  | 'dm'
  | 'group'
  | 'space'
  | 'space-public'
  | 'signal'
  | 'proposal'
  | 'ecosystem'
  | 'network';

export type InboxFilter =
  | 'all'
  | 'direct'
  | 'spaces'
  | 'rooms'
  | 'proposals'
  | 'signals'
  | 'ecosystem'
  | 'network';

export const INBOX_FILTERS: readonly InboxFilter[] = [
  'all',
  'direct',
  'spaces',
  'rooms',
  'proposals',
  'signals',
  'ecosystem',
  'network',
];

/** Alias localparts written when those rooms are created. */
const NETWORK_ALIAS = 'hypha-network';
const ECOSYSTEM_ALIAS_PREFIX = 'hypha-ecosystem';
const PUBLIC_ALIAS_PREFIX = 'hypha-public';

const ROOM_TYPE_KIND: Record<string, InboxChannelKind> = {
  'io.hypha.room.dm': 'dm',
  'io.hypha.room.group': 'group',
  'io.hypha.room.space': 'space',
  'io.hypha.room.space-public': 'space-public',
  'io.hypha.room.signal': 'signal',
  'io.hypha.room.proposal': 'proposal',
  'io.hypha.room.ecosystem': 'ecosystem',
  'io.hypha.room.network': 'network',
};

export type InboxPlace = {
  kind: InboxChannelKind;
  spaceTitle: string | null;
  spaceSlug: string | null;
  ecosystemTitle: string | null;
  ecosystemSlug: string | null;
  signalTitle: string | null;
  signalType: string | null;
  signalSlug: string | null;
  proposalTitle: string | null;
  proposalSlug: string | null;
};

export type InboxSpaceLabel = {
  id: number;
  slug: string;
  title: string;
  parentId: number | null;
  chatRoomId: string | null;
  rootSlug: string;
  rootTitle: string;
};

export type InboxSignalLabel = {
  roomId: string;
  title: string;
  type: string;
  slug: string;
  spaceSlug: string;
  spaceTitle: string;
  rootSlug: string;
  rootTitle: string;
  /** The member is an assignee, so signal messages notify them. */
  notified: boolean;
};

/** Open proposal (`documents.state = proposal`) the member can vote on. */
export type InboxProposalLabel = {
  roomId: string;
  title: string;
  slug: string;
  spaceSlug: string;
  spaceTitle: string;
  rootSlug: string;
  rootTitle: string;
};

export type InboxContext = {
  spaces: readonly InboxSpaceLabel[];
  signals: readonly InboxSignalLabel[];
  proposals?: readonly InboxProposalLabel[];
};

export type JoinedChannelSnapshot = {
  roomId: string;
  roomType: string;
  name: string;
  aliases: readonly string[];
  preview: string;
  mine: boolean;
  /** Matrix user id of the person who sent the preview. */
  senderUserId?: string | null;
  lastTs: number | null;
  unread: number;
  /** Latest signal-team list already loaded in this room includes the member. */
  onSignalTeam?: boolean;
  /** A loaded message in this room @-mentions the member. */
  mentioned?: boolean;
};

/** Channels with no message in this window stay out of the inbox. */
export const INBOX_CHANNEL_ACTIVE_MONTHS = 3;

const EMPTY_CONTEXT: InboxContext = {
  spaces: [],
  signals: [],
  proposals: [],
};

export function isInboxFilter(
  value: string | null | undefined,
): value is InboxFilter {
  return INBOX_FILTERS.some((filter) => filter === value);
}

export function inboxKindForRoomType(
  roomType: string | null | undefined,
): InboxChannelKind | null {
  const typed = roomType?.trim();
  if (!typed) return null;
  return ROOM_TYPE_KIND[typed] ?? null;
}

/** Rooms the messages list can show besides direct and group chats. */
export function isInboxChannelKind(
  kind: InboxChannelKind | null | undefined,
): kind is Exclude<InboxChannelKind, 'dm' | 'group'> {
  return (
    kind === 'space' ||
    kind === 'space-public' ||
    kind === 'signal' ||
    kind === 'proposal' ||
    kind === 'ecosystem' ||
    kind === 'network'
  );
}

export function inboxChannelActiveSince(now = Date.now()): number {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - INBOX_CHANNEL_ACTIVE_MONTHS);
  return cutoff.getTime();
}

/** A channel is active when it has a message inside the last three months. */
export function channelHasRecentActivity(
  lastTs: number | null | undefined,
  now = Date.now(),
): boolean {
  if (lastTs == null || !Number.isFinite(lastTs) || lastTs <= 0) return false;
  return lastTs >= inboxChannelActiveSince(now);
}

function normalizedSlug(value: string | null | undefined): string | null {
  const slug = value?.trim().toLowerCase();
  return slug || null;
}

/**
 * A joined channel is relevant when the member belongs there:
 * a space they are in, an ecosystem one of those spaces sits in,
 * a signal they are on or notified about, or the network.
 * Everyone belongs to the network.
 */
export function channelIsRelevantToMember(
  snapshot: Pick<
    JoinedChannelSnapshot,
    'roomId' | 'onSignalTeam' | 'mentioned'
  >,
  place: InboxPlace,
  context: InboxContext,
): boolean {
  // One network room, and every member belongs to it.
  if (place.kind === 'network') return true;
  // Space chat notifications go to everyone joined to the member room.
  // Hiding that room when a membership lookup misses them would leave a
  // notification with nowhere to open.
  if (place.kind === 'space') return true;
  if (place.kind === 'ecosystem') {
    const slug = normalizedSlug(place.ecosystemSlug);
    if (!slug) return false;
    return context.spaces.some(
      (space) =>
        normalizedSlug(space.rootSlug) === slug ||
        normalizedSlug(space.slug) === slug,
    );
  }
  if (place.kind === 'space-public') {
    const slug = normalizedSlug(place.spaceSlug);
    const roomId = snapshot.roomId.trim();
    return context.spaces.some(
      (space) =>
        (slug != null && normalizedSlug(space.slug) === slug) ||
        (roomId.length > 0 && space.chatRoomId?.trim() === roomId),
    );
  }
  if (place.kind === 'signal') {
    if (snapshot.onSignalTeam || snapshot.mentioned) return true;
    const roomId = snapshot.roomId.trim();
    return context.signals.some(
      (signal) => signal.notified && signal.roomId.trim() === roomId,
    );
  }
  if (place.kind === 'proposal') {
    const roomId = snapshot.roomId.trim();
    return (context.proposals ?? []).some(
      (proposal) => proposal.roomId.trim() === roomId,
    );
  }
  return false;
}

export function rowMatchesInboxFilter(
  kind: InboxChannelKind,
  filter: InboxFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'direct') return kind === 'dm' || kind === 'group';
  if (filter === 'spaces') {
    return (
      kind === 'space' ||
      kind === 'space-public' ||
      kind === 'signal' ||
      kind === 'proposal'
    );
  }
  if (filter === 'rooms') return kind === 'space' || kind === 'space-public';
  if (filter === 'proposals') return kind === 'proposal';
  if (filter === 'signals') return kind === 'signal';
  if (filter === 'ecosystem') return kind === 'ecosystem';
  return kind === 'network';
}

export function inboxFilterCounts(
  rows: readonly { kind: InboxChannelKind; unread: number }[],
): Record<InboxFilter, { total: number; unread: number }> {
  const counts = Object.fromEntries(
    INBOX_FILTERS.map((filter) => [filter, { total: 0, unread: 0 }]),
  ) as Record<InboxFilter, { total: number; unread: number }>;
  for (const row of rows) {
    const unread = row.unread > 0 ? row.unread : 0;
    for (const filter of INBOX_FILTERS) {
      if (!rowMatchesInboxFilter(row.kind, filter)) continue;
      counts[filter].total += 1;
      counts[filter].unread += unread;
    }
  }
  return counts;
}

/** About one screen of conversations beside the channel menu. */
export const INBOX_LIST_PAGE = 8;

/**
 * The rows to paint. Counts and unread badges stay on the full list;
 * this only shortens what is on screen until the list scrolls to the end.
 */
export function inboxListWindow<T>(
  rows: readonly T[],
  visibleCount: number,
): { rows: T[]; hasMore: boolean } {
  const count = Number.isFinite(visibleCount)
    ? Math.max(0, Math.floor(visibleCount))
    : 0;
  const shown = rows.slice(0, count);
  return { rows: shown, hasMore: shown.length < rows.length };
}

export function aliasLocalpart(
  alias: string | null | undefined,
): string | null {
  const trimmed = alias?.trim();
  if (!trimmed) return null;
  const body = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  const colon = body.indexOf(':');
  const local = (colon === -1 ? body : body.slice(0, colon))
    .trim()
    .toLowerCase();
  return local || null;
}

function slugAfterPrefix(localpart: string, prefix: string): string | null {
  const head = `${prefix}-`;
  if (!localpart.startsWith(head)) return null;
  const slug = localpart.slice(head.length).trim();
  return slug || null;
}

export function placeFromAliases(
  aliases: readonly string[],
): Partial<InboxPlace> | null {
  for (const alias of aliases) {
    const local = aliasLocalpart(alias);
    if (!local) continue;
    if (local === NETWORK_ALIAS) {
      return { kind: 'network' };
    }
    const ecosystem = slugAfterPrefix(local, ECOSYSTEM_ALIAS_PREFIX);
    if (ecosystem) return { kind: 'ecosystem', ecosystemSlug: ecosystem };
    const space = slugAfterPrefix(local, PUBLIC_ALIAS_PREFIX);
    if (space) return { kind: 'space-public', spaceSlug: space };
  }
  return null;
}

function spaceBySlug(spaces: readonly InboxSpaceLabel[], slug: string | null) {
  const key = slug?.trim().toLowerCase();
  if (!key) return null;
  return (
    spaces.find((space) => space.slug.trim().toLowerCase() === key) ??
    spaces.find((space) => space.rootSlug.trim().toLowerCase() === key) ??
    null
  );
}

function spaceByRoomId(spaces: readonly InboxSpaceLabel[], roomId: string) {
  const id = roomId.trim();
  if (!id) return null;
  return spaces.find((space) => space.chatRoomId?.trim() === id) ?? null;
}

function signalByRoomId(signals: readonly InboxSignalLabel[], roomId: string) {
  const id = roomId.trim();
  if (!id) return null;
  return signals.find((signal) => signal.roomId.trim() === id) ?? null;
}

function proposalByRoomId(
  proposals: readonly InboxProposalLabel[] | undefined,
  roomId: string,
) {
  const id = roomId.trim();
  if (!id) return null;
  return proposals?.find((proposal) => proposal.roomId.trim() === id) ?? null;
}

function clean(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text || null;
}

/**
 * Channel kind for a room the member has already joined.
 * A direct or group type is never a channel. A room with no type can still
 * be the network, an ecosystem, a public room, or a stored space or signal room.
 */
export function inboxKindForJoinedRoom(input: {
  roomType?: string | null;
  aliases?: readonly string[];
  roomId: string;
  context?: InboxContext;
}): InboxChannelKind | null {
  const typed = inboxKindForRoomType(input.roomType);
  if (typed === 'dm' || typed === 'group') return null;
  if (isInboxChannelKind(typed)) return typed;
  if (input.roomType?.trim()) return null;
  const fromAlias = placeFromAliases(input.aliases ?? []);
  if (fromAlias?.kind && isInboxChannelKind(fromAlias.kind)) {
    return fromAlias.kind;
  }
  const context = input.context;
  if (!context) return null;
  if (spaceByRoomId(context.spaces, input.roomId)) return 'space';
  if (signalByRoomId(context.signals, input.roomId)) return 'signal';
  if (proposalByRoomId(context.proposals, input.roomId)) return 'proposal';
  return null;
}

export function resolveInboxPlace(
  snapshot: Pick<JoinedChannelSnapshot, 'roomId' | 'roomType' | 'aliases'>,
  context: InboxContext = EMPTY_CONTEXT,
): InboxPlace | null {
  const kind = inboxKindForJoinedRoom({
    roomType: snapshot.roomType,
    aliases: snapshot.aliases,
    roomId: snapshot.roomId,
    context,
  });
  if (!isInboxChannelKind(kind)) return null;
  const alias = placeFromAliases(snapshot.aliases);
  const signal = signalByRoomId(context.signals, snapshot.roomId);
  const proposal = proposalByRoomId(context.proposals, snapshot.roomId);
  const byRoom = spaceByRoomId(context.spaces, snapshot.roomId);
  const bySlug = spaceBySlug(
    context.spaces,
    signal?.spaceSlug ??
      proposal?.spaceSlug ??
      (alias?.spaceSlug as string | undefined) ??
      (alias?.ecosystemSlug as string | undefined) ??
      null,
  );
  const space = byRoom ?? bySlug;
  const ecosystemSlug =
    clean(signal?.rootSlug) ??
    clean(proposal?.rootSlug) ??
    clean(space?.rootSlug) ??
    clean(alias?.ecosystemSlug as string | undefined);
  const ecosystemTitle =
    clean(signal?.rootTitle) ??
    clean(proposal?.rootTitle) ??
    clean(space?.rootTitle) ??
    null;
  return {
    kind,
    spaceTitle:
      clean(signal?.spaceTitle) ??
      clean(proposal?.spaceTitle) ??
      clean(space?.title),
    spaceSlug:
      clean(signal?.spaceSlug) ??
      clean(proposal?.spaceSlug) ??
      clean(space?.slug),
    ecosystemTitle,
    ecosystemSlug,
    signalTitle: clean(signal?.title),
    signalType: clean(signal?.type),
    signalSlug: clean(signal?.slug),
    proposalTitle: clean(proposal?.title),
    proposalSlug: clean(proposal?.slug),
  };
}

export function inboxContextLine(
  place: InboxPlace,
  signalTypeLabel: string | null,
): string | null {
  const space = place.spaceTitle;
  const root =
    place.ecosystemTitle && place.ecosystemTitle !== space
      ? place.ecosystemTitle
      : null;
  if (place.kind === 'signal') {
    const parts = [signalTypeLabel, space, root].filter(
      (part): part is string => Boolean(part),
    );
    return parts.length > 0 ? parts.join(' · ') : null;
  }
  if (
    place.kind === 'space' ||
    place.kind === 'space-public' ||
    place.kind === 'proposal'
  ) {
    const parts = [space, root].filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(' · ') : null;
  }
  return null;
}

export function channelDisplayName(
  snapshot: Pick<JoinedChannelSnapshot, 'name'>,
  place: InboxPlace,
  networkFallback: string,
): string {
  if (place.kind === 'signal' && place.signalTitle) return place.signalTitle;
  if (place.kind === 'proposal' && place.proposalTitle) {
    return place.proposalTitle;
  }
  if (place.kind === 'network') {
    const named = snapshot.name.trim();
    return named || networkFallback;
  }
  if (place.kind === 'ecosystem' && place.ecosystemTitle) {
    return place.ecosystemTitle;
  }
  if (
    (place.kind === 'space' || place.kind === 'space-public') &&
    place.spaceTitle
  ) {
    return place.spaceTitle;
  }
  return snapshot.name.trim() || networkFallback;
}

export function peopleInboxKind(row: {
  faces?: readonly unknown[];
}): 'dm' | 'group' {
  return row.faces ? 'group' : 'dm';
}

/** Where the channel icon sends someone. Direct chats stay in the inbox. */
export function inboxContextHref(
  lang: string,
  place: InboxPlace | null | undefined,
): string | null {
  const locale = lang.trim();
  if (!locale || !place) return null;
  if (place.kind === 'dm' || place.kind === 'group') return null;
  if (place.kind === 'network') return `/${locale}/network`;
  const space = place.spaceSlug?.trim() || '';
  if (place.kind === 'signal') {
    if (!space) return null;
    const signal = place.signalSlug?.trim();
    if (!signal) return `/${locale}/dho/${space}/overview?spaceChat=space`;
    // Signals board with that card selected (and its chat opened when enabled).
    return `/${locale}/dho/${space}/coherence?signal=${encodeURIComponent(
      signal,
    )}`;
  }
  if (place.kind === 'proposal') {
    const proposal = place.proposalSlug?.trim();
    if (!space || !proposal) return null;
    return `/${locale}/dho/${space}/agreements/proposal/${encodeURIComponent(
      proposal,
    )}`;
  }
  if (place.kind === 'space') {
    // Space dashboard with the member space room open.
    return space ? `/${locale}/dho/${space}/overview?spaceChat=space` : null;
  }
  if (place.kind === 'space-public') {
    return space ? `/${locale}/dho/${space}/overview?spaceChat=public` : null;
  }
  // Ecosystem channel → space dashboard with the ecosystem room open.
  const ecosystemSpace = space || place.ecosystemSlug?.trim() || '';
  return ecosystemSpace
    ? `/${locale}/dho/${ecosystemSpace}/overview?spaceChat=ecosystem`
    : null;
}

export function directInboxPlace(kind: 'dm' | 'group'): InboxPlace {
  return {
    kind,
    spaceTitle: null,
    spaceSlug: null,
    ecosystemTitle: null,
    ecosystemSlug: null,
    signalTitle: null,
    signalType: null,
    signalSlug: null,
    proposalTitle: null,
    proposalSlug: null,
  };
}

export type InboxChannelRow = {
  person: {
    id: number;
    name: string | null;
    surname: null;
    nickname: null;
    avatarUrl: null;
    slug: string | null;
    sharedSpaceCount: 0;
  };
  name: string;
  preview: string;
  mine: boolean;
  senderUserId?: string | null;
  lastTs: number | null;
  unread: number;
  roomId: string;
  inbox: InboxPlace;
  searchMembers: { name: string }[];
};

function channelPersonId(roomId: string) {
  let hash = 0;
  for (let index = 0; index < roomId.length; index += 1) {
    hash = (Math.imul(hash, 31) + roomId.charCodeAt(index)) | 0;
  }
  const id = -Math.abs(hash);
  return id === 0 ? -1 : id;
}

function isCanonicalNetworkRoom(snapshot: JoinedChannelSnapshot): boolean {
  return snapshot.aliases.some(
    (alias) => aliasLocalpart(alias) === NETWORK_ALIAS,
  );
}

/**
 * One row per joined channel the member actually belongs to, and only when
 * that channel has a message in the last three months. The room id is the
 * one Matrix already has. There is a single network room.
 */
export function channelRowsFromSnapshots(
  snapshots: readonly JoinedChannelSnapshot[],
  context: InboxContext,
  networkFallback: string,
  now = Date.now(),
): InboxChannelRow[] {
  const rows: InboxChannelRow[] = [];
  const seen = new Set<string>();
  let networkSlot: {
    index: number;
    canonical: boolean;
    lastTs: number;
  } | null = null;
  for (const snapshot of snapshots) {
    const roomId = snapshot.roomId.trim();
    if (!roomId || seen.has(roomId)) continue;
    const place = resolveInboxPlace(snapshot, context);
    if (!place || !channelIsRelevantToMember(snapshot, place, context)) {
      continue;
    }
    // Assignees, the signal team, and people who were mentioned are notified
    // even when nobody has written in the room lately. Proposal chats stay
    // visible the same way once someone has written — empty rooms would flood
    // the inbox. Other channels stay hidden until they have a message in the
    // last three months.
    if (place.kind === 'proposal') {
      if (!snapshot.preview.trim()) continue;
    } else if (
      place.kind !== 'signal' &&
      !channelHasRecentActivity(snapshot.lastTs, now)
    ) {
      continue;
    }
    if (place.kind === 'network' && networkSlot) {
      const canonical = isCanonicalNetworkRoom(snapshot);
      const lastTs = snapshot.lastTs ?? 0;
      const replace =
        (canonical && !networkSlot.canonical) ||
        (canonical === networkSlot.canonical && lastTs > networkSlot.lastTs);
      if (!replace) continue;
      rows.splice(networkSlot.index, 1);
      networkSlot = null;
    }
    seen.add(roomId);
    if (place.kind === 'network') {
      networkSlot = {
        index: rows.length,
        canonical: isCanonicalNetworkRoom(snapshot),
        lastTs: snapshot.lastTs ?? 0,
      };
    }
    const name = channelDisplayName(snapshot, place, networkFallback);
    const searchNames = [
      name,
      place.spaceTitle,
      place.spaceSlug,
      place.ecosystemTitle,
      place.ecosystemSlug,
      place.signalTitle,
      place.signalType,
      place.signalSlug,
      place.proposalTitle,
      place.proposalSlug,
    ].filter((value): value is string => Boolean(value));
    rows.push({
      person: {
        id: channelPersonId(roomId),
        name,
        surname: null,
        nickname: null,
        avatarUrl: null,
        slug: place.spaceSlug,
        sharedSpaceCount: 0,
      },
      name,
      preview: snapshot.preview,
      mine: snapshot.mine,
      senderUserId: snapshot.senderUserId ?? null,
      lastTs: snapshot.lastTs,
      unread: snapshot.unread,
      roomId,
      inbox: place,
      searchMembers: searchNames.map((label) => ({ name: label })),
    });
  }
  return rows;
}
