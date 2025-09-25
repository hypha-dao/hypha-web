'use client';

import React from 'react';
import OneSignal, {
  NotificationClickEvent,
  NotificationDismissEvent,
  NotificationForegroundWillDisplayEvent,
  SubscriptionChangeEvent,
  UserChangeEvent,
} from 'react-onesignal';
import { NotificationsContext } from '../hooks';
import { useMe } from '@hypha-platform/core/client';

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
  const { person, isLoading } = useMe();
  const [initialized, setInitialized] = React.useState(false);
  const [subscribed, setSubscribed] = React.useState(false);

  const login = React.useCallback(() => {
    if (!OneSignal || isLoading || !person?.slug) {
      return;
    }
    OneSignal.login(person.slug).then(() => {
      console.log('subscribe');
      setSubscribed(true);
    });
  }, [OneSignal, person, isLoading]);

  const handleUserPushSubscriptionChange = React.useCallback(
    (event: SubscriptionChangeEvent) => {
      console.log('User PushSubscription change:', event);
      console.log('event.previous.id', event.previous.id);
      console.log('event.current.id', event.current.id);
      console.log('event.previous.token', event.previous.token);
      console.log('event.current.token', event.current.token);
      console.log('event.previous.optedIn', event.previous.optedIn);
      console.log('event.current.optedIn', event.current.optedIn);
      if (event.current.token) {
        console.log(`The push subscription has received a token!`);
        login();
      }
    },
    [login],
  );

  React.useEffect(() => {
    if (!initialized || !OneSignal) {
      return;
    }
    OneSignal.User.PushSubscription.addEventListener(
      'change',
      handleUserPushSubscriptionChange,
    );
    return () => {
      OneSignal.User.PushSubscription.removeEventListener(
        'change',
        handleUserPushSubscriptionChange,
      );
    };
  }, [initialized, OneSignal, handleUserPushSubscriptionChange]);

  React.useEffect(() => {
    OneSignal.init({
      appId,
      serviceWorkerPath,
      promptOptions: {
        slidedown: {
          prompts: [
            {
              autoPrompt: false,
              categories: [],
              delay: {},
              text: {
                actionMessage:
                  'TEST: Subscribe if you’d like to be notified about proposals and other Network activity.',
                acceptButton: 'Subscribe',
                cancelMessage: 'Later',
              },
              type: 'push',
            },
          ],
        },
      },
    }).then(() => {
      console.log('OneSignal initialized');
      setInitialized(true);
      const externalId = initialized ? OneSignal?.User?.externalId : undefined;
      setSubscribed(Boolean(externalId));
      console.log('OneSignal.User.externalId:', externalId);
      OneSignal.Notifications.addEventListener(
        'click',
        (event: NotificationClickEvent) => {
          console.log('The notification was clicked!', event);
        },
      );
      OneSignal.Notifications.addEventListener(
        'foregroundWillDisplay',
        (event: NotificationForegroundWillDisplayEvent) => {
          console.log('The notification foreground will display:', event);
        },
      );
      OneSignal.Notifications.addEventListener(
        'dismiss',
        (event: NotificationDismissEvent) => {
          console.log('The notification dismiss:', event);
        },
      );
      OneSignal.Notifications.addEventListener(
        'permissionChange',
        (permission: boolean) => {
          console.log('The notification permission change:', permission);
        },
      );
      OneSignal.Notifications.addEventListener(
        'permissionPromptDisplay',
        () => {
          console.log('The notification permission prompt display!');
        },
      );
      OneSignal.Slidedown.addEventListener(
        'slidedownAllowClick',
        (wasShown: boolean) => {
          console.log('Slidedown Allow Click:', wasShown);
        },
      );
      OneSignal.Slidedown.addEventListener(
        'slidedownCancelClick',
        (wasShown: boolean) => {
          console.log('Slidedown Cancel Click:', wasShown);
        },
      );
      OneSignal.Slidedown.addEventListener(
        'slidedownClosed',
        (wasShown: boolean) => {
          console.log('Slidedown Closed:', wasShown);
        },
      );
      OneSignal.Slidedown.addEventListener(
        'slidedownQueued',
        (wasShown: boolean) => {
          console.log('Slidedown Queued:', wasShown);
        },
      );
      OneSignal.Slidedown.addEventListener(
        'slidedownShown',
        (wasShown: boolean) => {
          console.log('Slidedown Shown:', wasShown);
        },
      );
      OneSignal.User.addEventListener('change', (change: UserChangeEvent) => {
        console.log('User change:', change);
      });
    });
  }, [appId, serviceWorkerPath]);

  return (
    <NotificationsContext.Provider
      value={{ initialized, setInitialized, subscribed, setSubscribed, login }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
