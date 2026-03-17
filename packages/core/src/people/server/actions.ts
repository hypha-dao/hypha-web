'use server';

import { updatePerson } from './mutations';
import { EditPersonInput } from '../types';
import { db } from '@hypha-platform/storage-postgres';

export async function editPersonAction(
  data: EditPersonInput,
  { authToken }: { authToken?: string },
) {
  void authToken;
  return updatePerson(data, { db });
}
