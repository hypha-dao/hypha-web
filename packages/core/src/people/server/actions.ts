'use server';

import { updatePerson } from './mutations';
import {
  EditPersonInput,
  GetPersonByIdInput,
  GetPersonBySubInput,
} from '../types';
import { db } from '@hypha-platform/storage-postgres';
import { findPersonById, findPersonBySub } from './queries';

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

export async function getPersonBySub(
  { sub }: GetPersonBySubInput,
  { authToken }: { authToken?: string },
) {
  if (!sub) {
    return null;
  }
  return findPersonBySub({ sub }, { db });
}
