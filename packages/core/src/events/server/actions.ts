'use server';

import { db } from '@hypha-platform/storage-postgres';
import { createEvent } from './mutations';
import { CreateEventInput } from '../types';

export async function createEventAction(
  data: CreateEventInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to create event');
  return createEvent({ ...data }, { db });
}
