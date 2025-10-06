import {
  findAllPeopleWithoutPagination,
  getAllSpaces,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export async function fetchMembersAndSpaces() {
  const spaces = await getAllSpaces({ parentOnly: false });

  const filteredSpaces = spaces.filter(
    (space) => space.address && space.address.trim() !== '',
  );

  const members = await findAllPeopleWithoutPagination({ db });

  const filteredMembers = members.filter(
    (member) => member.address && member.address.trim() !== '',
  );

  return { spaces: filteredSpaces, members: filteredMembers };
}
