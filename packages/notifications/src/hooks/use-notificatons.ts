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

  const subscribe = React.useCallback(() => {
    console.log('Initialized on subscribe:', initialized);
    if (!initialized) {
      return;
    }
    setError(null);
    if (OneSignal.Notifications.permission) {
      login?.();
      return;
    }
    OneSignal.Slidedown.promptPush({ force: DEV_ENV }).catch((err: any) => {
      console.warn('Error:', err);
      setError('Notification permissions declined.');
    });
  }, [OneSignal, initialized, setError, login]);
  const unsubscribe = React.useCallback(() => {
    console.log('Initialized on unsubscribe:', initialized);
    if (!initialized) {
      return;
    }
    setError(null);
    OneSignal.logout().then(() => {
      console.log('unsubscribe');
      setSubscribed?.(false);
    });
  }, [OneSignal, initialized, setError, setSubscribed]);

  return {
    subscribed,
    subscribe,
    unsubscribe,
    error,
  };
};
