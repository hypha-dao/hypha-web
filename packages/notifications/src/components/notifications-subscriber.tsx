'use client';

import React from 'react';
import OneSignal from 'react-onesignal';
import { NotificationsContext } from '../hooks';

export interface NotificationSubscriberProps {
  appId: string;
  serviceWorkerPath?: string;
  children: React.ReactNode;
}

export function NotificationSubscriber({
  appId,
  serviceWorkerPath,
  children,
}: NotificationSubscriberProps) {
  const [initialized, setInitialized] = React.useState(false);
  React.useEffect(() => {
    OneSignal.init({
      appId,
      serviceWorkerPath,
    }).then(() => {
      console.log('OneSignal initialized');
      setInitialized(true);
    });
  }, [appId, serviceWorkerPath]);

  return (
    <NotificationsContext.Provider value={{ initialized, setInitialized }}>
      {children}
    </NotificationsContext.Provider>
  );
}
