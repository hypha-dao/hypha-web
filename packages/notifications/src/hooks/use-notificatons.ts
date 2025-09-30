'use client';

import { useMe } from '@hypha-platform/core/client';
import React from 'react';
import OneSignal from 'react-onesignal';

const DEV_ENV = process.env.NODE_ENV === 'development';

const TRUE = 'true';
const FALSE = 'false';

export const TAG_SUBSCRIBED = 'subscribed';
export const TAG_PUSH = 'push';
export const TAG_EMAIL = 'email';
export const TAG_NEW_PROPOSAL_OPEN = 'opt_newProposalOpen';
export const TAG_PROPOSAL_APPROVED_OR_REJECTED =
  'opt_proposalApprovedOrRejected';

export const TAGS = [
  TAG_SUBSCRIBED,
  TAG_PUSH,
  TAG_EMAIL,
  TAG_NEW_PROPOSAL_OPEN,
  TAG_PROPOSAL_APPROVED_OR_REJECTED,
] as const;
export type Tag = (typeof TAGS)[number];

export interface INotificationsContext {
  initialized: boolean;
  setInitialized: React.Dispatch<React.SetStateAction<boolean>>;
  subscribed: boolean;
  setSubscribed: React.Dispatch<React.SetStateAction<boolean>>;
  loggedIn: boolean;
}

export interface NotificationCofiguration {
  emailNotifications: boolean;
  browserNotifications: boolean;
  newProposalOpen: boolean;
  proposalApprovedOrRejected: boolean;
}

export const NotificationsContext = React.createContext<INotificationsContext>({
  initialized: false,
  setInitialized: (_: React.SetStateAction<boolean>) => {},
  subscribed: false,
  setSubscribed: (_: React.SetStateAction<boolean>) => {},
  loggedIn: false,
});

export interface NotificationsProps {
  personSlug: string;
}

export function checkTag(
  tags: {
    [key: string]: string;
  },
  tagName: Tag,
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
    const browserNotifications = DEV_ENV
      ? OneSignal.User.PushSubscription.optedIn ?? true
      : checkTag(tags, TAG_PUSH, true);
    const emailNotifications = checkTag(tags, TAG_EMAIL, true);
    const newProposalOpen = checkTag(tags, TAG_NEW_PROPOSAL_OPEN, true);
    const proposalApprovedOrRejected = checkTag(
      tags,
      TAG_PROPOSAL_APPROVED_OR_REJECTED,
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
      await OneSignal.User.addTag(TAG_SUBSCRIBED, TRUE);
      setSubscribed(true);
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
      await OneSignal.User.removeTag(TAG_SUBSCRIBED);
      setSubscribed(false);
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
        if (!DEV_ENV) {
          await OneSignal.User.addTag(TAG_PUSH, TRUE);
        }
      } else {
        if (OneSignal.User.PushSubscription.optedIn) {
          await OneSignal.User.PushSubscription.optOut();
        }
        if (!DEV_ENV) {
          await OneSignal.User.addTag(TAG_PUSH, FALSE);
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
      if (!DEV_ENV) {
        if (configuration.newProposalOpen) {
          await OneSignal.User.addTag(TAG_NEW_PROPOSAL_OPEN, TRUE);
        } else {
          await OneSignal.User.addTag(TAG_NEW_PROPOSAL_OPEN, FALSE);
        }
        if (configuration.proposalApprovedOrRejected) {
          await OneSignal.User.addTag(TAG_PROPOSAL_APPROVED_OR_REJECTED, TRUE);
        } else {
          await OneSignal.User.addTag(TAG_PROPOSAL_APPROVED_OR_REJECTED, FALSE);
        }
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
