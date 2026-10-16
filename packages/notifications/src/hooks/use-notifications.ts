'use client';

import { Person } from '@hypha-platform/core/client';
import React from 'react';
import OneSignal from 'react-onesignal';
import {
  isTagDisabled,
  SUBSCRIPTION_TAGS,
  SubscriptionTag,
  Tag,
  TAG_EMAIL,
  TAG_PUSH,
  TAG_SUB_OWN_ACTIONS,
  TAG_SUBSCRIBED,
  TAG_VALUE_DISABLED,
} from '../constants';

const TRUE = 'true';
const FALSE = 'false';

export interface INotificationsContext {
  initialized: boolean;
  setInitialized: React.Dispatch<React.SetStateAction<boolean>>;
  subscribed: boolean;
  setSubscribed: React.Dispatch<React.SetStateAction<boolean>>;
  loggedIn: boolean;
}

export interface NotificationConfiguration {
  emailNotifications: boolean;
  browserNotifications: boolean;
  /** One entry per preference group (#2549 D3) with its real stored state. */
  subscriptions: {
    name: SubscriptionTag;
    value: boolean;
  }[];
}

export const NotificationsContext = React.createContext<INotificationsContext>({
  initialized: false,
  setInitialized: (_: React.SetStateAction<boolean>) => {},
  subscribed: false,
  setSubscribed: (_: React.SetStateAction<boolean>) => {},
  loggedIn: false,
});

/** Opt-in tags (`subscribed`): only an explicit `'true'` counts. */
export function checkTag(
  tags: {
    [key: string]: string;
  },
  tagName: Tag,
  defaultValue: boolean,
) {
  return Object.hasOwn(tags, tagName) ? tags[tagName] === TRUE : defaultValue;
}

/**
 * Preference toggles are enabled by default (#2549 D4): on unless the tag is `'disabled'` or the
 * legacy `'false'`. Mirrors the server-side consent gate.
 */
export function isTagEnabled(
  tags: {
    [key: string]: string;
  },
  tagName: Tag,
) {
  return !isTagDisabled(tags[tagName]);
}

/** Switching a preference on removes its tag; switching it off writes the `'disabled'` marker. */
async function writePreferenceTag(tagName: Tag, enabled: boolean) {
  if (enabled) {
    await OneSignal.User.removeTag(tagName);
  } else {
    await OneSignal.User.addTag(tagName, TAG_VALUE_DISABLED);
  }
}

export async function hasPermission() {
  if (!OneSignal) {
    return false;
  }
  try {
    const tags = await OneSignal.User.getTags();
    const isSubscribed = checkTag(tags, TAG_SUBSCRIBED, false);
    const externalId = OneSignal.User.externalId;
    const permission = OneSignal.Notifications.permission;
    return permission && isSubscribed && Boolean(externalId);
  } catch (err) {
    console.warn('Failed to check notification permission', err);
    return false;
  }
}

export const useNotifications = ({
  person,
  isLoading,
}: {
  person: Person | undefined;
  isLoading: boolean;
}) => {
  const { initialized, subscribed, setSubscribed, loggedIn } =
    React.useContext(NotificationsContext);
  const [error, setError] = React.useState<string | null>(null);
  const [configuration, setConfiguration] =
    React.useState<NotificationConfiguration>();

  const initializeConfiguration = React.useCallback(async () => {
    if (!initialized || !OneSignal || !loggedIn) {
      return;
    }
    try {
      const tags = await OneSignal.User.getTags();
      setConfiguration({
        browserNotifications: isTagEnabled(tags, TAG_PUSH),
        emailNotifications: isTagEnabled(tags, TAG_EMAIL),
        subscriptions: SUBSCRIPTION_TAGS.map((tagName) => ({
          name: tagName,
          value: isTagEnabled(tags, tagName),
        })),
      });
    } catch (err) {
      console.warn('Failed to initialize notification configuration', err);
      setError('Could not load notification settings.');
    }
  }, [initialized, OneSignal, loggedIn, setError]);

  React.useEffect(() => {
    initializeConfiguration();
  }, [initializeConfiguration]);

  const subscribe = React.useCallback(async () => {
    if (!initialized) {
      console.warn('Cannot subscribe notifications until initialized');
      return;
    }
    setError(null);
    try {
      await OneSignal.Slidedown.promptPush({ force: true });
      await OneSignal.User.addTag(TAG_SUBSCRIBED, TRUE);
      // Own-action confirmations start switched off (#2549 D5) — but never overwrite a choice the
      // user already made.
      const tags = await OneSignal.User.getTags();
      if (!Object.hasOwn(tags, TAG_SUB_OWN_ACTIONS)) {
        await OneSignal.User.addTag(TAG_SUB_OWN_ACTIONS, TAG_VALUE_DISABLED);
      }
      setSubscribed(true);
      await initializeConfiguration();
    } catch (err) {
      console.warn('Error:', err);
      setError('Notification permissions declined.');
    }
  }, [OneSignal, initialized, setError, initializeConfiguration]);
  const unsubscribe = React.useCallback(async () => {
    if (!initialized) {
      console.warn('Cannot unsubscribe notifications until initialized');
      return;
    }
    setError(null);
    try {
      await OneSignal.User.addTag(TAG_SUBSCRIBED, FALSE);
      setSubscribed(false);
    } catch (err) {
      console.warn('Error:', err);
    }
  }, [OneSignal, initialized, setError, setSubscribed]);
  const saveConfigurations = React.useCallback(
    async (configuration: NotificationConfiguration) => {
      if (!initialized) {
        console.warn('Cannot save notification settings until initialized');
        return;
      }
      if (isLoading || !person) {
        console.warn(
          'Cannot save notification settings while user data is loading',
        );
        return;
      }
      setError(null);
      try {
        if (configuration.browserNotifications) {
          if (!OneSignal.User.PushSubscription.optedIn) {
            await OneSignal.User.PushSubscription.optIn();
          }
        } else if (OneSignal.User.PushSubscription.optedIn) {
          await OneSignal.User.PushSubscription.optOut();
        }
        await writePreferenceTag(TAG_PUSH, configuration.browserNotifications);

        if (configuration.emailNotifications) {
          if (person.email) {
            await OneSignal.User.addEmail(person.email);
          }
        } else if (person.email) {
          await OneSignal.User.removeEmail(person.email);
        }
        await writePreferenceTag(TAG_EMAIL, configuration.emailNotifications);

        for (const subscription of configuration.subscriptions) {
          await writePreferenceTag(subscription.name, subscription.value);
        }
        setConfiguration(configuration);
      } catch (err) {
        console.warn('Failed to save notification configuration', err);
        setError('Could not save notification settings. Please try again.');
      }
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
