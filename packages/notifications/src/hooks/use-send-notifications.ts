'use client';

import useSWRMutation from 'swr/mutation';
import {
  NotifyProposalAcceptedInput,
  NotifyProposalCreatedInput,
  NotifyProposalRejectedInput,
  UseSendNotificationsHook,
  UseSendNotificationsInput,
  UseSendNotificationsReturn,
} from '@hypha-platform/core/client';
import {
  notifyProposalAcceptedAction,
  notifyProposalCreatedAction,
  notifyProposalRejectedAction,
} from '../actions';

export const useSendNotifications: UseSendNotificationsHook = ({
  authToken,
}: UseSendNotificationsInput): UseSendNotificationsReturn => {
  if (!authToken) {
    throw new Error('No authToken provided, cannot notify');
  }

  const { trigger: notifyProposalCreated } = useSWRMutation(
    authToken ? [authToken, 'notifyProposalCreated'] : null,
    async (
      [authToken],
      {
        arg,
      }: {
        arg: NotifyProposalCreatedInput;
      },
    ) => notifyProposalCreatedAction(arg, { authToken }),
  );

  const { trigger: notifyProposalAccepted } = useSWRMutation(
    authToken ? [authToken, 'notifyProposalAccepted'] : null,
    async ([authToken], { arg }: { arg: NotifyProposalAcceptedInput }) =>
      notifyProposalAcceptedAction(arg, { authToken }),
  );

  const { trigger: notifyProposalRejected } = useSWRMutation(
    authToken ? [authToken, 'notifyProposalRejected'] : null,
    async ([authToken], { arg }: { arg: NotifyProposalRejectedInput }) =>
      notifyProposalRejectedAction(arg, { authToken }),
  );

  return {
    notifyProposalCreated,
    notifyProposalAccepted,
    notifyProposalRejected,
  };
};
