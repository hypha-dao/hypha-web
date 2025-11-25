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
    const notificationClickHandler = (event: NotificationClickEvent) => {
      console.log('The notification was clicked!', event);
      if (event.notification.launchURL) {
        const url = new URL(
          event.notification.launchURL,
          window.location.origin,
        );
        router.push(url.pathname + url.search + url.hash);
      }
    };
    const foregroundWillDisplayHandler = (
      event: NotificationForegroundWillDisplayEvent,
    ) => {
      console.log('The notification foreground will display:', event);
    };
    const notificationDismiss = (event: NotificationDismissEvent) => {
      console.log('The notification dismiss:', event);
    };
    const permissionChangeHandler = (permission: boolean) => {
      console.log('The notification permission change:', permission);
      if (!permission) {
        setSubscribed(false);
      }
    };
    const permissionPromptDisplayHandler = () => {
      console.log('The notification permission prompt display!');
    };
    const slidedownAllowClickHandler = (wasShown: boolean) => {
      console.log('Slidedown Allow Click:', wasShown);
    };
    const slidedownCancelClick = (wasShown: boolean) => {
      console.log('Slidedown Cancel Click:', wasShown);
      setSubscribed(false);
    };
    const slidedownClosedHandler = (wasShown: boolean) => {
      console.log('Slidedown Closed:', wasShown);
    };
    const slidedownQueuedHandler = (wasShown: boolean) => {
      console.log('Slidedown Queued:', wasShown);
    };
    const slidedownShownHandler = (wasShown: boolean) => {
      console.log('Slidedown Shown:', wasShown);
    };
    const userChangeHandler = (change: UserChangeEvent) => {
      console.log('User change:', change);
    };
    const subscriptionChangeHandler = (event: SubscriptionChangeEvent) => {
      console.log('User PushSubscription change:', event);
      console.log('event.previous.id', event.previous.id);
      console.log('event.current.id', event.current.id);
      console.log('event.previous.token', event.previous.token);
      console.log('event.current.token', event.current.token);
      console.log('event.previous.optedIn', event.previous.optedIn);
      console.log('event.current.optedIn', event.current.optedIn);
    };
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
          notificationClickHandler,
        );
        OneSignal.Notifications.addEventListener(
          'foregroundWillDisplay',
          foregroundWillDisplayHandler,
        );
        OneSignal.Notifications.addEventListener(
          'dismiss',
          notificationDismiss,
        );
        OneSignal.Notifications.addEventListener(
          'permissionChange',
          permissionChangeHandler,
        );
        OneSignal.Notifications.addEventListener(
          'permissionPromptDisplay',
          permissionPromptDisplayHandler,
        );
        OneSignal.Slidedown.addEventListener(
          'slidedownAllowClick',
          slidedownAllowClickHandler,
        );
        OneSignal.Slidedown.addEventListener(
          'slidedownCancelClick',
          slidedownCancelClick,
        );
        OneSignal.Slidedown.addEventListener(
          'slidedownClosed',
          slidedownClosedHandler,
        );
        OneSignal.Slidedown.addEventListener(
          'slidedownQueued',
          slidedownQueuedHandler,
        );
        OneSignal.Slidedown.addEventListener(
          'slidedownShown',
          slidedownShownHandler,
        );
        OneSignal.User.addEventListener('change', userChangeHandler);
        OneSignal.User.PushSubscription.addEventListener(
          'change',
          subscriptionChangeHandler,
        );
      } catch (err) {
        console.log('Initialize error:', err);
      }
    };
    initialize();
    return () => {
      OneSignal.Notifications.removeEventListener(
        'click',
        notificationClickHandler,
      );
      OneSignal.Notifications.removeEventListener(
        'foregroundWillDisplay',
        foregroundWillDisplayHandler,
      );
      OneSignal.Notifications.removeEventListener(
        'dismiss',
        notificationDismiss,
      );
      OneSignal.Notifications.removeEventListener(
        'permissionChange',
        permissionChangeHandler,
      );
      OneSignal.Notifications.removeEventListener(
        'permissionPromptDisplay',
        permissionPromptDisplayHandler,
      );
      OneSignal.Slidedown.removeEventListener(
        'slidedownAllowClick',
        slidedownAllowClickHandler,
      );
      OneSignal.Slidedown.removeEventListener(
        'slidedownCancelClick',
        slidedownCancelClick,
      );
      OneSignal.Slidedown.removeEventListener(
        'slidedownClosed',
        slidedownClosedHandler,
      );
      OneSignal.Slidedown.removeEventListener(
        'slidedownQueued',
        slidedownQueuedHandler,
      );
      OneSignal.Slidedown.removeEventListener(
        'slidedownShown',
        slidedownShownHandler,
      );
      OneSignal.User.removeEventListener('change', userChangeHandler);
      OneSignal.User.PushSubscription.removeEventListener(
        'change',
        subscriptionChangeHandler,
      );
    };
  }, [appId, safariWebId, serviceWorkerPath]);

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
