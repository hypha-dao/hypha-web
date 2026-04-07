import type { Space } from '../types';
import type { Membership } from '@hypha-platform/storage-postgres';

/** Minimal person shape for roster building (avoids importing `@hypha-platform/core/client` in tests). */
export type RosterPerson = {
  id: number;
  slug?: string;
  name?: string;
  surname?: string;
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
  join_source: 'membership' | 'event' | 'unknown';
  joined_at: string | null;
  person: PersonPublic;
};

export type SpaceMemberRosterSpace = {
  member_kind: 'space';
  membership: null;
  join_source: 'event' | 'unknown';
  joined_at: string | null;
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

export function normalizeMemberAddress(a: string): string {
  return a.toLowerCase();
}

/**
 * Earliest join time per member address from `joinSpace` events (UI parity).
 */
export function mergeJoinEventTimesByAddress(
  eventRows: ReadonlyArray<{ createdAt: Date; parameters: unknown }>,
): Map<string, Date> {
  const map = new Map<string, Date>();
  for (const ev of eventRows) {
    const params = ev.parameters as Record<string, unknown> | null | undefined;
    const raw = params?.['memberAddress'];
    if (typeof raw !== 'string') continue;
    const key = normalizeMemberAddress(raw);
    const prev = map.get(key);
    const t = ev.createdAt;
    if (!prev || t < prev) {
      map.set(key, t);
    }
  }
  return map;
}

/**
 * Stable order: follow on-chain member list order; each address becomes at most
 * one roster entry (person row wins over space row if both matched — edge case).
 *
 * Join display: prefer `memberships` when present; else `joinSpace` events (same
 * source as MemberCard / SpaceMemberCard); otherwise unknown.
 */
export function buildMemberEntriesFromAddresses(args: {
  memberAddresses: readonly `0x${string}`[];
  peopleByAddress: Map<string, RosterPerson>;
  spacesByAddress: Map<string, Space>;
  membershipByPersonId: Map<number, Membership>;
  /** Earliest join time per normalized member address from events table */
  eventJoinTimeByAddress?: Map<string, Date>;
}): SpaceMemberRosterEntry[] {
  const {
    memberAddresses,
    peopleByAddress,
    spacesByAddress,
    eventJoinTimeByAddress,
  } = args;
  const { membershipByPersonId } = args;
  const entries: SpaceMemberRosterEntry[] = [];

  for (const raw of memberAddresses) {
    const key = normalizeMemberAddress(raw);
    const person = peopleByAddress.get(key);
    if (person) {
      const m = membershipByPersonId.get(person.id);
      const membership = m ? membershipToSnake(m) : null;
      const eventAt = eventJoinTimeByAddress?.get(key);

      let join_source: 'membership' | 'event' | 'unknown';
      let joined_at: string | null;

      if (m) {
        join_source = 'membership';
        joined_at = toIso(m.createdAt);
      } else if (eventAt) {
        join_source = 'event';
        joined_at = toIso(eventAt);
      } else {
        join_source = 'unknown';
        joined_at = null;
      }

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
      const eventAt = eventJoinTimeByAddress?.get(key);
      const join_source: 'event' | 'unknown' = eventAt ? 'event' : 'unknown';
      const joined_at = eventAt ? toIso(eventAt) : null;
      entries.push({
        member_kind: 'space',
        membership: null,
        join_source,
        joined_at,
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
      return [p.name, p.surname, p.nickname, p.slug]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    }
    const s = e.space;
    return (
      s.title.toLowerCase().includes(term) ||
      (s.description?.toLowerCase().includes(term) ?? false)
    );
  });
}
