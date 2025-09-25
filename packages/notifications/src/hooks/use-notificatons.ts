'use client';

import React from 'react';
import OneSignal from 'react-onesignal';

const DEV_ENV = process.env.NODE_ENV === 'development';

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
  const { initialized } = React.useContext(NotificationsContext);
  const [subscribed, setSubscribed] = React.useState<boolean>(
    initialized ? Boolean(OneSignal?.User?.externalId) ?? false : false,
  );
  const [error, setError] = React.useState<string | null>(null);
  const externalId = React.useMemo(() => {
    return initialized ? OneSignal?.User?.externalId : undefined;
  }, [initialized, OneSignal, subscribed]);

  React.useEffect(() => {
    setSubscribed(Boolean(externalId));
  }, [externalId]);
  React.useEffect(() => {
    console.log('Updated OneSignal.User.externalId:', externalId);
  }, [externalId]);

  const subscribe = React.useCallback(() => {
    console.log('Initialized on subscribe:', initialized);
    if (!initialized) {
      return;
    }
    setError(null);
    OneSignal.Slidedown.promptPush({ force: DEV_ENV })
      // .then(() => OneSignal.Notifications.requestPermission())
      // .then(() => {
      //   const permission = OneSignal.Notifications.permission;
      //   console.log('permission:', permission);
      //   if (!permission) {
      //     return Promise.reject('Declined');
      //   }
      // })
      // .then(() => OneSignal.login(personSlug))
      // .then(() => {
      //   console.log('subscribe');
      //   setSubscribed(true);
      // })
      .catch((err: any) => {
        console.warn('Error:', err);
        setError('Notification permissions declined.');
      });
  }, [personSlug, setSubscribed, setError]);
  const unsubscribe = React.useCallback(() => {
    console.log('Initialized on unsubscribe:', initialized);
    if (!initialized) {
      return;
    }
    setError(null);
    // OneSignal.logout().then(() => {
    //   console.log('unsubscribe');
    //   setSubscribed(false);
    // });
  }, [personSlug, setSubscribed, setError]);

  return {
    subscribed,
    subscribe,
    unsubscribe,
    error,
  };
};
