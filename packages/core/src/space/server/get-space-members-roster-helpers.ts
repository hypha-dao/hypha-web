import type { Space } from '../types';
import type { Membership } from '@hypha-platform/storage-postgres';

/** Minimal person shape for roster building (avoids importing `@hypha-platform/core/client` in tests). */
export type RosterPerson = {
  id: number;
  slug?: string;
  name?: string;
  surname?: string;
  email?: string;
  avatarUrl?: string;
  leadImageUrl?: string;
  description?: string;
  location?: string;
  nickname?: string;
  address?: string;
  links?: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type MembershipSnake = {
  id: number;
  person_id: number;
  space_id: number;
  created_at: string;
  updated_at: string;
};

export type PersonPublic = RosterPerson;

export type SpaceMemberRosterPerson = {
  member_kind: 'person';
  membership: MembershipSnake | null;
  join_source: 'membership' | 'unknown';
  joined_at: string | null;
  person: PersonPublic;
};

export type SpaceMemberRosterSpace = {
  member_kind: 'space';
  membership: null;
  join_source: 'unknown';
  joined_at: null;
  space: Space;
};

export type SpaceMemberRosterEntry =
  | SpaceMemberRosterPerson
  | SpaceMemberRosterSpace;

function toIso(d: Date): string {
  return new Date(d).toISOString();
}

function membershipToSnake(m: Membership): MembershipSnake {
  return {
    id: m.id,
    person_id: m.personId,
    space_id: m.spaceId,
    created_at: toIso(m.createdAt),
    updated_at: toIso(m.updatedAt),
  };
}

function personToPublic(person: RosterPerson): PersonPublic {
  return { ...person };
}

function normalizeAddr(a: string): string {
  return a.toLowerCase();
}

/**
 * Stable order: follow on-chain member list order; each address becomes at most
 * one roster entry (person row wins over space row if both matched — edge case).
 */
export function buildMemberEntriesFromAddresses(args: {
  memberAddresses: readonly `0x${string}`[];
  peopleByAddress: Map<string, RosterPerson>;
  spacesByAddress: Map<string, Space>;
  membershipByPersonId: Map<number, Membership>;
}): SpaceMemberRosterEntry[] {
  const { memberAddresses, peopleByAddress, spacesByAddress } = args;
  const { membershipByPersonId } = args;
  const entries: SpaceMemberRosterEntry[] = [];

  for (const raw of memberAddresses) {
    const key = normalizeAddr(raw);
    const person = peopleByAddress.get(key);
    if (person) {
      const m = membershipByPersonId.get(person.id);
      const membership = m ? membershipToSnake(m) : null;
      const join_source: 'membership' | 'unknown' = m
        ? 'membership'
        : 'unknown';
      const joined_at = m ? toIso(m.createdAt) : null;
      entries.push({
        member_kind: 'person',
        membership,
        join_source,
        joined_at,
        person: personToPublic(person),
      });
      continue;
    }
    const memberSpace = spacesByAddress.get(key);
    if (memberSpace) {
      entries.push({
        member_kind: 'space',
        membership: null,
        join_source: 'unknown',
        joined_at: null,
        space: memberSpace,
      });
      continue;
    }
  }

  return entries;
}

export function applySearchFilter(
  entries: SpaceMemberRosterEntry[],
  searchTerm: string | undefined,
): SpaceMemberRosterEntry[] {
  if (!searchTerm?.trim()) return entries;
  const term = searchTerm.trim().toLowerCase();
  return entries.filter((e) => {
    if (e.member_kind === 'person') {
      const p = e.person;
      return (
        [p.name, p.surname, p.nickname, p.email, p.slug]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)) === true
      );
    }
    const s = e.space;
    return (
      s.title.toLowerCase().includes(term) ||
      (s.description?.toLowerCase().includes(term) ?? false)
    );
  });
}
