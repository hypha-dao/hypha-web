'use client';

import React from 'react';
import OneSignal, {
  NotificationClickEvent,
  NotificationDismissEvent,
  NotificationForegroundWillDisplayEvent,
  SubscriptionChangeEvent,
  UserChangeEvent,
} from 'react-onesignal';
import { HookRegistryProvider, useMe } from '@hypha-platform/core/client';
import {
  hasPermission,
  NotificationsContext,
  useSendNotifications,
} from '../hooks';
import { useRouter } from 'next/navigation';

const DEV_ENV = process.env.NODE_ENV === 'development';

export interface NotificationSubscriberProps {
  appId: string;
  safariWebId: string;
  serviceWorkerPath?: string;
  children: React.ReactNode;
}

export function NotificationSubscriber({
  appId,
  safariWebId,
  serviceWorkerPath,
  children,
}: NotificationSubscriberProps) {
  const { person, isLoading } = useMe();
  const [initialized, setInitialized] = React.useState(false);
  const [subscribed, setSubscribed] = React.useState(false);
  const [loggedIn, setLoggedIn] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (!initialized || !OneSignal || isLoading) {
      return;
    }
    if (person?.slug) {
      const loginNotifications = async (personSlug: string) => {
        try {
          const currentExternalId = OneSignal.User.externalId;
          if (currentExternalId !== personSlug) {
            if (currentExternalId) {
              await OneSignal.logout();
            }
            await OneSignal.login(personSlug);
          }
          setLoggedIn(true);
          const isSubscribed = await hasPermission();
          setSubscribed(isSubscribed);
        } catch (err) {
          console.error('Error on login:', err);
        }
      };
      loginNotifications(person.slug);
    } else {
      const logoutNotifications = async () => {
        if (OneSignal.User.externalId) {
          await OneSignal.logout();
        }
        setLoggedIn(false);
        setSubscribed(false);
      };
      logoutNotifications();
    }
  }, [initialized, OneSignal, isLoading, person]);

  React.useEffect(() => {
    const initialize = async () => {
      if (initialized) {
        console.warn('OneSignal should be initialized only once!');
        return;
      }
      try {
        const scope = serviceWorkerPath
          ? `/${serviceWorkerPath.split('/').filter(Boolean)[0]}/`
          : '/';
        await OneSignal.init({
          appId,
          safari_web_id: safariWebId,
          serviceWorkerPath,
          serviceWorkerParam: { scope },
          allowLocalhostAsSecureOrigin: DEV_ENV,
          promptOptions: {
            slidedown: {
              prompts: [
                {
                  autoPrompt: false,
                  categories: [],
                  delay: {},
                  text: {
                    actionMessage:
                      'Subscribe if you’d like to be notified about proposals and other Network activity.',
                    acceptButton: 'Subscribe',
                    cancelMessage: 'Later',
                  },
                  type: 'push',
                },
              ],
            },
          },
          welcomeNotification: {
            disable: true,
            message: '',
          },
          notificationClickHandlerMatch: 'origin',
          notificationClickHandlerAction: 'focus',
        });
        console.log('OneSignal initialized');
        setInitialized(true);
        const isSubscribed = await hasPermission();
        setSubscribed(isSubscribed);
        OneSignal.Notifications.addEventListener(
          'click',
          (event: NotificationClickEvent) => {
            console.log('The notification was clicked!', event);
            if (event.notification.launchURL) {
              const url = new URL(
                event.notification.launchURL,
                window.location.origin,
              );
              router.push(url.pathname + url.search + url.hash);
            }
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
            if (!permission) {
              setSubscribed(false);
            }
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
            setSubscribed(false);
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
        OneSignal.User.PushSubscription.addEventListener(
          'change',
          (event: SubscriptionChangeEvent) => {
            console.log('User PushSubscription change:', event);
            console.log('event.previous.id', event.previous.id);
            console.log('event.current.id', event.current.id);
            console.log('event.previous.token', event.previous.token);
            console.log('event.current.token', event.current.token);
            console.log('event.previous.optedIn', event.previous.optedIn);
            console.log('event.current.optedIn', event.current.optedIn);
          },
        );
      } catch (err) {
        console.log('Initialize error:', err);
      }
    };
    initialize();
  }, [appId, serviceWorkerPath]);

  return (
    <NotificationsContext.Provider
      value={{
        initialized,
        setInitialized,
        subscribed,
        setSubscribed,
        loggedIn,
      }}
    >
      <HookRegistryProvider useSendNotifications={useSendNotifications}>
        {children}
      </HookRegistryProvider>
    </NotificationsContext.Provider>
  );
}
