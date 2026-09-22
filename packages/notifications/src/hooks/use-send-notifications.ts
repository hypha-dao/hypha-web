'use client';

import useSWRMutation from 'swr/mutation';
import {
  NotifyCallStartedInput,
  NotifyChatMentionInput,
  UseSendNotificationsHook,
  UseSendNotificationsInput,
  UseSendNotificationsReturn,
} from '@hypha-platform/core/client';
import { notifyCallStartedAction, notifyChatMentionAction } from '../actions';

const noOp = async () => {
  console.warn('Cannot send notification empty authToken');
};

export const useSendNotifications: UseSendNotificationsHook = ({
  authToken,
}: UseSendNotificationsInput): UseSendNotificationsReturn => {
  const { trigger: notifyChatMention } = useSWRMutation(
    authToken ? [authToken, 'notifyChatMention'] : null,
    async ([authToken], { arg }: { arg: NotifyChatMentionInput }) =>
      notifyChatMentionAction(arg, { authToken }),
  );

  const { trigger: notifyCallStarted } = useSWRMutation(
    authToken ? [authToken, 'notifyCallStarted'] : null,
    async ([authToken], { arg }: { arg: NotifyCallStartedInput }) =>
      notifyCallStartedAction(arg, { authToken }),
  );

  return {
    notifyChatMention: authToken ? notifyChatMention : noOp,
    notifyCallStarted: authToken ? notifyCallStarted : noOp,
  };
};
