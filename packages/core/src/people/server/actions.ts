'use server';

import { updatePerson } from './mutations';
import {
  EditPersonInput,
  GetPersonByIdInput,
  GetPersonBySubInput,
} from '../types';
import { db } from '@hypha-platform/storage-postgres';
import {
  findAllPeopleWithoutPagination,
  findPersonById,
  findPersonBySub,
} from './queries';

export async function editPersonAction(
  data: EditPersonInput,
  { authToken }: { authToken?: string },
) {
  return updatePerson(data as any, { db });
}

export async function getPersonById(
  { id }: GetPersonByIdInput,
  { authToken }: { authToken?: string },
) {
  if (!id) {
    return null;
  }
  return findPersonById({ id }, { db });
}

/** People a direct transfer can pay. Same list as Transfer funds. */
export async function listTransferRecipientPeople() {
  const people = await findAllPeopleWithoutPagination({ db });
  return people.flatMap((person) => {
    const address = person.address?.trim();
    if (!address) return [];
    return [
      {
        id: person.id,
        name: person.name ?? '',
        surname: person.surname ?? '',
        avatarUrl: person.avatarUrl ?? null,
        address,
        slug: person.slug ?? '',
      },
    ];
  });
}

export async function getPersonBySub(
  { sub }: GetPersonBySubInput,
  { authToken }: { authToken?: string },
) {
  if (!sub) {
    return null;
  }
  return findPersonBySub({ sub }, { db });
}
