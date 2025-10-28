'use client';

import useSWRMutation from 'swr/mutation';
import { CreateEventInput } from '../../types';
import { createEventAction } from '../../server/actions';

export const useCreateEvent = ({
  authToken,
}: {
  authToken?: string | null;
}) => {
  const { trigger: createEvent } = useSWRMutation(
    authToken ? [authToken, 'createEvent'] : null,
    async ([authToken], { arg }: { arg: CreateEventInput }) =>
      createEventAction(arg, { authToken }),
  );

  return {
    createEvent,
  };
};
