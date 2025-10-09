import {
  findAllPeopleWithoutPagination,
  getAllSpaces,
  Person,
  Space,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

interface FetchMembersAndSpacesParams {
  activeSpaceId?: number;
}

export async function fetchMembersAndSpaces({
  activeSpaceId,
}: FetchMembersAndSpacesParams): Promise<{
  spaces: Space[];
  members: Person[];
}> {
  try {
    const spaces = await getAllSpaces({ parentOnly: false });

    const filteredSpaces = spaces.filter(
      (space) =>
        space.address &&
        space.address.trim() !== '' &&
        space.id !== activeSpaceId,
    );

    const members = await findAllPeopleWithoutPagination({ db });

    const filteredMembers = members.filter(
      (member) => member.address && member.address.trim() !== '',
    );

    return { spaces: filteredSpaces, members: filteredMembers };
  } catch (error) {
    throw new Error('Failed to fetch members and spaces', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
