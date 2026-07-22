import 'server-only';

import {
  computeSpaceMemberEntries,
  findPeopleBySpaceSlug,
  type DbConfig,
  type Person,
  type Space,
} from '@hypha-platform/core/server';

const SPACE_MEMBER_PAGE_SIZE = 1000;

/**
 * Recipients for energy forms: only people and spaces that are members of the
 * host space (on-chain roster when available, otherwise DB memberships).
 *
 * Note: the DB fallback returns `spaces: []` by design — space-to-space
 * memberships are recorded on-chain only and have no database source.
 */
export async function fetchSpaceMemberRecipients(
  spaceSlug: string,
  { db }: DbConfig,
): Promise<{
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

  const members: Person[] = [];
  let page = 1;
  let hasNextPage = true;
  while (hasNextPage) {
    const peopleResult = await findPeopleBySpaceSlug(
      { spaceSlug },
      { db, pagination: { page, pageSize: SPACE_MEMBER_PAGE_SIZE } },
    );
    members.push(
      ...peopleResult.data.filter((person) => Boolean(person.address?.trim())),
    );
    hasNextPage = peopleResult.pagination.hasNextPage;
    page += 1;
  }

  return { members, spaces: [] };
}
