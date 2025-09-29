'use client';

import { useMe } from '@hypha-platform/core/client';
import React from 'react';
import OneSignal from 'react-onesignal';

const DEV_ENV = process.env.NODE_ENV === 'development';

const TRUE = 'true';
const FALSE = 'false';

const TAG_EMAIL = 'email';

export interface INotificationsContext {
  initialized?: boolean;
  setInitialized?: React.Dispatch<React.SetStateAction<boolean>>;
  subscribed?: boolean;
  setSubscribed?: React.Dispatch<React.SetStateAction<boolean>>;
  loggedIn?: boolean;
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

export function checkTag(
  tags: {
    [key: string]: string;
  },
  tagName: string,
  defaultValue: boolean,
) {
  return Object.hasOwn(tags, tagName) ? tags[tagName] === TRUE : defaultValue;
}

export const useNotifications = ({ personSlug }: NotificationsProps) => {
  const { initialized, subscribed, setSubscribed, loggedIn } =
    React.useContext(NotificationsContext);
  const [error, setError] = React.useState<string | null>(null);
  const [configuration, setConfiguration] =
    React.useState<NotificationCofiguration>();
  const { person, isLoading } = useMe();

  const initializeConfiguration = React.useCallback(async () => {
    if (!initialized || !OneSignal || !loggedIn) {
      return;
    }
    const tags = await OneSignal.User.getTags();
    const browserNotifications =
      OneSignal.User.PushSubscription.optedIn ?? true;
    const emailNotifications = checkTag(tags, TAG_EMAIL, true);
    const newProposalOpen = checkTag(tags, 'opt_newProposalOpen', true);
    const proposalApprovedOrRejected = checkTag(
      tags,
      'opt_proposalApprovedOrRejected',
      true,
    );
    setConfiguration({
      browserNotifications,
      emailNotifications,
      newProposalOpen,
      proposalApprovedOrRejected,
    });
  }, [initialized, OneSignal, loggedIn]);

  React.useEffect(() => {
    initializeConfiguration();
  }, [initializeConfiguration]);

  const subscribe = React.useCallback(async () => {
    console.log('Initialized on subscribe:', initialized);
    if (!initialized) {
      return;
    }
    setError(null);
    try {
      console.log('subscribe');
      await OneSignal.Slidedown.promptPush({ force: DEV_ENV });
      await OneSignal.User.addTag('subscribed', TRUE);
      setSubscribed?.(true);
      await initializeConfiguration();
    } catch (err) {
      console.warn('Error:', err);
      setError('Notification permissions declined.');
    }
  }, [OneSignal, initialized, setError, initializeConfiguration]);
  const unsubscribe = React.useCallback(async () => {
    console.log('Initialized on unsubscribe:', initialized);
    if (!initialized) {
      return;
    }
    setError(null);
    try {
      console.log('unsubscribe');
      await OneSignal.User.removeTag('subscribed');
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
      if (configuration.browserNotifications) {
        if (!OneSignal.User.PushSubscription.optedIn) {
          await OneSignal.User.PushSubscription.optIn();
        }
      } else {
        if (OneSignal.User.PushSubscription.optedIn) {
          await OneSignal.User.PushSubscription.optOut();
        }
      }
      if (configuration.emailNotifications) {
        if (!isLoading && person?.email) {
          await OneSignal.User.addEmail(person.email);
          await OneSignal.User.addTag(TAG_EMAIL, TRUE);
        }
      } else {
        if (!isLoading && person?.email) {
          await OneSignal.User.removeEmail(person.email);
          await OneSignal.User.addTag(TAG_EMAIL, FALSE);
        }
      }
      if (configuration.newProposalOpen) {
        await OneSignal.User.addTag('opt_newProposalOpen', TRUE);
      } else {
        await OneSignal.User.addTag('opt_newProposalOpen', FALSE);
      }
      if (configuration.proposalApprovedOrRejected) {
        await OneSignal.User.addTag('opt_proposalApprovedOrRejected', TRUE);
      } else {
        await OneSignal.User.addTag('opt_proposalApprovedOrRejected', FALSE);
      }
      setConfiguration(configuration);
    },
    [OneSignal, initialized, person, isLoading],
  );

  return {
    subscribed,
    subscribe,
    unsubscribe,
    configuration,
    setConfiguration,
    saveConfigurations,
    error,
  };
};
