'use client';

import React from 'react';
import OneSignal from 'react-onesignal';

const DEV_ENV = process.env.NODE_ENV === 'development';

export interface INotificationsContext {
  initialized?: boolean;
  setInitialized?: React.Dispatch<React.SetStateAction<boolean>>;
  subscribed?: boolean;
  setSubscribed?: React.Dispatch<React.SetStateAction<boolean>>;
  login?: () => void;
}

export interface NotificationCofiguration {
  emailNotifications: boolean;
  browserNotifications: boolean;
  newProposalOpen: boolean;
  proposalApprovedOrRejected: boolean;
}

export const NotificationsContext = React.createContext<INotificationsContext>(
  {},
);

export interface NotificationsProps {
  personSlug: string;
}

export const useNotifications = ({ personSlug }: NotificationsProps) => {
  const { initialized, subscribed, setSubscribed, login } =
    React.useContext(NotificationsContext);
  const [error, setError] = React.useState<string | null>(null);

  const subscribe = React.useCallback(async () => {
    console.log('Initialized on subscribe:', initialized);
    if (!initialized) {
      return;
    }
    setError(null);
    if (OneSignal.Notifications.permission) {
      login?.();
      return;
    }
    try {
      await OneSignal.Slidedown.promptPush({ force: DEV_ENV });
    } catch (err) {
      console.warn('Error:', err);
      setError('Notification permissions declined.');
    }
  }, [OneSignal, initialized, setError, login]);
  const unsubscribe = React.useCallback(async () => {
    console.log('Initialized on unsubscribe:', initialized);
    if (!initialized) {
      return;
    }
    setError(null);
    try {
      await OneSignal.logout();
      console.log('unsubscribe');
      setSubscribed?.(false);
    } catch (err) {
      console.warn('Error:', err);
    }
  }, [OneSignal, initialized, setError, setSubscribed]);
  const saveConfigurations = React.useCallback(
    async (configuration: NotificationCofiguration) => {
      console.log('Initialized on save configurations:', initialized);
      if (!initialized) {
        return;
      }
      //TODO
      if (configuration.browserNotifications) {
        //TODO: subscribe push notifications
      } else {
        //TODO: unsubscribe push notifications
      }
      if (configuration.emailNotifications) {
        //TODO: subscribe email notifications
      } else {
        //TODO: unsubscribe email notifications
      }
      if (configuration.newProposalOpen) {
        //TODO: subscribe to a new proposal is open for vote
      } else {
        //TODO: unsubscribe to a new proposal is open for vote
      }
      if (configuration.proposalApprovedOrRejected) {
        //TODO: subscribe to a proposal is approved or rejected
      } else {
        //TODO: unsubscribe to a proposal is approved or rejected
      }
    },
    [OneSignal, initialized],
  );

  return {
    subscribed,
    subscribe,
    unsubscribe,
    saveConfigurations,
    error,
  };
};
