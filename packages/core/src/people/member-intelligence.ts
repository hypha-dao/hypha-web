import type { MemberOrientation } from './member-intelligence-guidance';

export type MemberAttentionItem = {
  id: string;
  kind: 'proposal' | 'signal';
  title: string;
  detail: string;
  spaceSlug: string;
  spaceTitle: string;
  targetSlug: string;
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
  };
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
  }>;
  proposals: Array<{
    id: number;
    slug: string | null;
    title: string;
    state: string | null;
    label: string | null;
    spaceSlug: string;
    spaceTitle: string;
    createdAt: string;
    authoredByMember: boolean;
  }>;
  signals: Array<{
    id: number;
    slug: string | null;
    title: string;
    type: string;
    priority: string | null;
    spaceSlug: string;
    spaceTitle: string;
    assignedToMember: boolean;
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
  }>;
  wallet: {
    address: string | null;
    preferredCurrency: string | null;
  };
  chatSpaceSlug: string | null;
};

export type MemberSpaceRow = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  logoUrl: string | null;
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
