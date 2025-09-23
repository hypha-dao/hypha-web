'use client';

import React from 'react';
import OneSignal from 'react-onesignal';

export interface INotificationsContext {
  initialized?: boolean;
  setInitialized?: React.Dispatch<React.SetStateAction<boolean>>;
}

export const NotificationsContext = React.createContext<INotificationsContext>(
  {},
);

export interface NotificationsProps {
  personSlug: string;
}

export const useNotifications = ({ personSlug }: NotificationsProps) => {
  const { initialized, setInitialized } =
    React.useContext(NotificationsContext);
  const [subscribed, setSubscribed] = React.useState<boolean>(
    Boolean(/*OneSignal.User?.onesignalId ?? */ false),
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSubscribed(Boolean(OneSignal.User?.onesignalId ?? false));
  }, [OneSignal]);

  const subscribe = React.useCallback(() => {
    console.log('Initialized on subscribe:', initialized);
    setError(null);
    OneSignal.Notifications.requestPermission()
      .then(() => {
        const permission = OneSignal.Notifications.permission;
        console.log('permission:', permission);
        if (!permission) {
          return Promise.reject('Declined');
        }
      })
      .then(
        () => {
          // return OneSignal.login(personSlug);
        },
        (err: any) => {
          console.warn('Error:', err);
          setError('Notification permissions declined.');
        },
      )
      .then(() => {
        setSubscribed(true);
      });
  }, [personSlug, setSubscribed, setError]);
  const unsubscribe = React.useCallback(() => {
    console.log('Initialized on unsubscribe:', initialized);
    setError(null);
    // OneSignal.logout().then(() => {
    setSubscribed(false);
    // });
  }, [personSlug, setSubscribed, setError]);

  return {
    subscribed,
    subscribe,
    unsubscribe,
    error,
  };
};
