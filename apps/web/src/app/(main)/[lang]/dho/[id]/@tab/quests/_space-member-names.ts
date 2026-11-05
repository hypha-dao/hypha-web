import { findPeopleBySpaceSlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export async function getSpaceMemberNames(
  spaceSlug: string,
): Promise<string[]> {
  try {
    const { data } = await findPeopleBySpaceSlug(
      { spaceSlug },
      { db, pagination: { page: 1, pageSize: 200 } },
    );
    return Array.from(
      new Set(
        data
          .map((person) =>
            [person.name, person.surname].filter(Boolean).join(' ').trim(),
          )
          .filter(Boolean),
      ),
    );
  } catch {
    return [];
  }
}
