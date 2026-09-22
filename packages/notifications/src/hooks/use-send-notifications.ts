'use client';

import useSWRMutation from 'swr/mutation';
import {
  NotifyCallStartedInput,
  UseSendNotificationsHook,
  UseSendNotificationsInput,
  UseSendNotificationsReturn,
} from '@hypha-platform/core/client';
import { notifyCallStartedAction } from '../actions';

const noOp = async () => {
  console.warn('Cannot send notification empty authToken');
};

export const useSendNotifications: UseSendNotificationsHook = ({
  authToken,
}: UseSendNotificationsInput): UseSendNotificationsReturn => {
  const { trigger: notifyCallStarted } = useSWRMutation(
    authToken ? [authToken, 'notifyCallStarted'] : null,
    async ([authToken], { arg }: { arg: NotifyCallStartedInput }) =>
      notifyCallStartedAction(arg, { authToken }),
  );

  return {
    notifyCallStarted: authToken ? notifyCallStarted : noOp,
  };
};
