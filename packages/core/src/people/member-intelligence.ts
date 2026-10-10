import type { MemberOrientation } from './member-intelligence-guidance';
import type { NetworkHorizon, NetworkHorizonSignal } from './network-horizon';

/** Same logo fields the space switcher resolves into an avatar. */
export type MemberSpaceLogo = {
  logoUrl: string | null;
  ecosystemLogoUrlLight: string | null;
  ecosystemLogoUrlDark: string | null;
};

export type MemberAttentionItem = {
  id: string;
  kind: 'proposal' | 'signal';
  title: string;
  detail: string;
  spaceSlug: string;
  spaceTitle: string;
  targetSlug: string;
  spaceLogo?: MemberSpaceLogo | null;
  /** Signal type, or the proposal label when one is set. */
  category?: string | null;
  summary?: string | null;
  creatorId?: number | null;
  creatorName?: string | null;
  creatorAvatarUrl?: string | null;
};

export type MemberIntelligence = {
  person: {
    id: number;
    slug: string;
    name: string | null;
    surname: string | null;
    nickname: string | null;
    avatarUrl: string | null;
    description: string | null;
    address: string | null;
    preferredCurrency: string | null;
    primaryOrientation: MemberOrientation | null;
    /** Where the member lives. Used when they listen beyond their spaces. */
    location?: string | null;
  };
  /**
   * `spaces` stays with the member's spaces. `network` also receives
   * needs and opportunities other spaces chose to share.
   * Absent on older payloads; treat that as `spaces`.
   */
  networkHorizon?: NetworkHorizon;
  /**
   * Shared needs and opportunities from other spaces, already ranked.
   * Empty when the horizon is `spaces`.
   */
  networkSignals?: NetworkHorizonSignal[];
  counts: {
    spaces: number;
    openProposals: number;
    signals: number;
    connections: number;
    notifications: number;
    capitalAsks: number;
  };
  guidance: {
    narrative: string;
  };
  attention: MemberAttentionItem[];
  spaces: Array<{
    id: number;
    slug: string;
    title: string;
    description: string;
    logoUrl: string | null;
    ecosystemLogoUrlLight?: string | null;
    ecosystemLogoUrlDark?: string | null;
    /** On-chain address a transfer can use. */
    address?: string | null;
    /** Chain id used to publish a proposal without leaving home. */
    web3SpaceId?: number | null;
  }>;
  proposals: Array<{
    id: number;
    slug: string | null;
    title: string;
    state: string | null;
    label: string | null;
    spaceSlug: string;
    spaceTitle: string;
    spaceLogo?: MemberSpaceLogo | null;
    createdAt: string;
    authoredByMember: boolean;
    /** On-chain proposal id used to vote without leaving home. Null for discussions. */
    web3ProposalId: number | null;
    /** On-chain space id for quorum and unity targets. */
    web3SpaceId?: number | null;
    leadImage?: string | null;
    description: string | null;
    creatorId: number | null;
    creatorName: string | null;
    creatorAvatarUrl: string | null;
  }>;
  signals: Array<{
    id: number;
    slug: string | null;
    title: string;
    type: string;
    priority: string | null;
    spaceSlug: string;
    spaceTitle: string;
    spaceLogo?: MemberSpaceLogo | null;
    assignedToMember: boolean;
    description: string | null;
    creatorId: number | null;
    creatorName: string | null;
    creatorAvatarUrl: string | null;
  }>;
  notifications: MemberAttentionItem[];
  connections: Array<{
    id: number;
    slug: string | null;
    name: string | null;
    surname: string | null;
    nickname: string | null;
    avatarUrl: string | null;
    sharedSpaceCount: number;
    /** Wallet a direct transfer can use. */
    address?: string | null;
  }>;
  wallet: {
    address: string | null;
    preferredCurrency: string | null;
  };
  chatSpaceSlug: string | null;
  /** Space join links still waiting on the member. Hidden after they join. */
  invites: MemberSpaceInvite[];
};

export type MemberSpaceInvite = {
  id: number;
  token: string;
  spaceSlug: string;
  spaceTitle: string;
};

export type MemberSpaceRow = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  logoUrl: string | null;
  ecosystemLogoUrlLight?: string | null;
  ecosystemLogoUrlDark?: string | null;
  address?: string | null;
  web3SpaceId?: number | null;
};

/** Chain memberships first, then any database rows not already included. */
export function mergeMemberSpaces(
  chainSpaces: MemberSpaceRow[],
  databaseSpaces: MemberSpaceRow[],
): MemberSpaceRow[] {
  const seen = new Set<number>();
  const merged: MemberSpaceRow[] = [];
  for (const space of [...chainSpaces, ...databaseSpaces]) {
    if (seen.has(space.id)) continue;
    seen.add(space.id);
    merged.push(space);
  }
  return merged;
}

export type SharedSpacePerson = {
  id: number;
  slug: string | null;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  address: string | null;
  sub: string | null;
};

export type SharedSpaceConnection = {
  id: number;
  slug: string | null;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  sharedSpaceCount: number;
  address?: string | null;
};

/**
 * Distinct other people whose wallets appear in the caller's space member
 * lists. The caller and space-actor profiles are left out. Each person is
 * counted once; `sharedSpaceCount` is how many of those spaces include them.
 */
export function peopleSharingMemberSpaces({
  callerPersonId,
  membersBySpace,
  people,
  spaceActorSubPrefix,
  limit,
}: {
  callerPersonId: number;
  membersBySpace: ReadonlyArray<{
    spaceId: number;
    addresses: readonly string[];
  }>;
  people: readonly SharedSpacePerson[];
  spaceActorSubPrefix: string;
  limit: number;
}): { count: number; connections: SharedSpaceConnection[] } {
  const spaceIdsByAddress = new Map<string, Set<number>>();
  for (const space of membersBySpace) {
    const seenInSpace = new Set<string>();
    for (const raw of space.addresses) {
      const key = raw.trim().toLowerCase();
      if (!key || seenInSpace.has(key)) continue;
      seenInSpace.add(key);
      const spaceIds = spaceIdsByAddress.get(key) ?? new Set<number>();
      spaceIds.add(space.spaceId);
      spaceIdsByAddress.set(key, spaceIds);
    }
  }

  const byId = new Map<number, SharedSpaceConnection>();
  for (const person of people) {
    if (person.id === callerPersonId || byId.has(person.id)) continue;
    if (person.sub?.startsWith(spaceActorSubPrefix)) continue;
    const key = person.address?.trim().toLowerCase();
    if (!key) continue;
    const sharedSpaceIds = spaceIdsByAddress.get(key);
    if (!sharedSpaceIds || sharedSpaceIds.size === 0) continue;
    byId.set(person.id, {
      id: person.id,
      slug: person.slug,
      name: person.name,
      surname: person.surname,
      nickname: person.nickname,
      avatarUrl: person.avatarUrl,
      address: person.address,
      sharedSpaceCount: sharedSpaceIds.size,
    });
  }

  const ranked = [...byId.values()].sort(
    (left, right) =>
      right.sharedSpaceCount - left.sharedSpaceCount || left.id - right.id,
  );

  return {
    count: ranked.length,
    connections: ranked.slice(0, Math.max(limit, 0)),
  };
}

export type DatedAttentionItem = MemberAttentionItem & { at: string };

/**
 * Newest item from each space first, then any remaining newest items.
 * A busy space cannot crowd out notifications from the caller's other spaces.
 */
export function pickNotificationsAcrossSpaces(
  items: readonly DatedAttentionItem[],
  limit: number,
): MemberAttentionItem[] {
  const cap = Math.max(limit, 0);
  if (cap === 0 || items.length === 0) return [];

  const sorted = [...items].sort((left, right) => {
    if (left.at !== right.at) return left.at < right.at ? 1 : -1;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });

  const picked: DatedAttentionItem[] = [];
  const seenSpaces = new Set<string>();
  for (const item of sorted) {
    if (picked.length >= cap) break;
    if (seenSpaces.has(item.spaceSlug)) continue;
    seenSpaces.add(item.spaceSlug);
    picked.push(item);
  }

  if (picked.length < cap) {
    const pickedIds = new Set(picked.map((item) => item.id));
    for (const item of sorted) {
      if (picked.length >= cap) break;
      if (pickedIds.has(item.id)) continue;
      picked.push(item);
    }
  }

  return picked.map(({ at: _at, ...item }) => item);
}

export type NetworkCapitalAsk = {
  id: number;
  slug: string | null;
  title: string;
  excerpt: string;
  state: string | null;
  spaceSlug: string;
  spaceTitle: string;
  createdAt: string;
};
