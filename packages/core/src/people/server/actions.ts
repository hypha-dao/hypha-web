'use server';

import { updatePerson } from './mutations';
import { EditPersonInput, GetPersonByIdInput, Person } from '../types';
import { db } from '@hypha-platform/storage-postgres';
import { findPersonById } from './queries';

export async function editPersonAction(
  data: EditPersonInput,
  { authToken }: { authToken?: string },
) {
  return await updatePerson(data as any, { db });
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
