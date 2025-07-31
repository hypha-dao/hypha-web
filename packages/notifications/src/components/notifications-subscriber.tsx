'use client';

import React, { useEffect } from 'react';
import OneSignal from 'react-onesignal';

export interface NotificationSubscriberProps {
  appId: string;
  serviceWorkerPath?: string;
}

export function NotificationSubscriber({
  appId,
  serviceWorkerPath,
}: NotificationSubscriberProps) {
  useEffect(() => {
    OneSignal.init({
      appId,
      serviceWorkerPath,
    });
  }, []);

  return <></>;
}
