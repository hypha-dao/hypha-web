import {
  computeSpaceMemberEntries,
  findPeopleBySpaceSlug,
  type Person,
  type Space,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

const SPACE_MEMBER_FETCH_LIMIT = 1000;

/**
 * Recipients for energy forms: only people and spaces that are members of the
 * host space (on-chain roster when available, otherwise DB memberships).
 */
export async function fetchSpaceMemberRecipients(spaceSlug: string): Promise<{
  members: Person[];
  spaces: Space[];
}> {
  const roster = await computeSpaceMemberEntries(spaceSlug, { db });

  if (roster.found && roster.entries.length > 0) {
    const members = roster.entries
      .filter(
        (entry): entry is Extract<typeof entry, { member_kind: 'person' }> =>
          entry.member_kind === 'person',
      )
      .map((entry) => entry.person as Person)
      .filter((person) => Boolean(person.address?.trim()));

    const spaces = roster.entries
      .filter(
        (entry): entry is Extract<typeof entry, { member_kind: 'space' }> =>
          entry.member_kind === 'space',
      )
      .map((entry) => entry.space)
      .filter((space) => Boolean(space.address?.trim()));

    return { members, spaces };
  }

  const peopleResult = await findPeopleBySpaceSlug(
    { spaceSlug },
    { db, pagination: { page: 1, pageSize: SPACE_MEMBER_FETCH_LIMIT } },
  );

  return {
    members: peopleResult.data.filter((person) =>
      Boolean(person.address?.trim()),
    ),
    spaces: [],
  };
}
