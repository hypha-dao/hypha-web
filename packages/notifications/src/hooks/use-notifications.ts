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
  /** This browser can actually receive push: permission granted and its subscription opted in. */
  pushActive: boolean;
  setPushActive: React.Dispatch<React.SetStateAction<boolean>>;
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
  pushActive: false,
  setPushActive: (_: React.SetStateAction<boolean>) => {},
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

/**
 * Account-level enrolment (the master switch): the user opted in (`subscribed` tag) and is logged
 * in to OneSignal. Independent of this browser's push permission (#2549 D25).
 */
export async function isEnrolled() {
  if (!OneSignal) {
    return false;
  }
  try {
    const tags = await OneSignal.User.getTags();
    return (
      checkTag(tags, TAG_SUBSCRIBED, false) &&
      Boolean(OneSignal.User.externalId)
    );
  } catch (err) {
    console.warn('Failed to check notification enrolment', err);
    return false;
  }
}

/** Device-level push state: this browser's permission is granted and its subscription is opted in. */
export function isPushActive() {
  if (!OneSignal) {
    return false;
  }
  try {
    return Boolean(
      OneSignal.Notifications.permission &&
        OneSignal.User.PushSubscription.optedIn,
    );
  } catch (err) {
    console.warn('Failed to check push state', err);
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
  const {
    initialized,
    subscribed,
    setSubscribed,
    pushActive,
    setPushActive,
    loggedIn,
  } = React.useContext(NotificationsContext);
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
        // Push is per device: on only if the user-level tag allows it AND this browser is opted in.
        browserNotifications: isTagEnabled(tags, TAG_PUSH) && isPushActive(),
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
      // Enrolment is account-level: a declined browser prompt must not block it (email still
      // works) - the push switch just stays off for this browser.
      try {
        await OneSignal.Slidedown.promptPush({ force: true });
      } catch (promptErr) {
        console.warn('Push prompt declined:', promptErr);
      }
      setPushActive(isPushActive());
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
      setError('Could not turn notifications on. Please try again.');
    }
  }, [
    OneSignal,
    initialized,
    setError,
    setSubscribed,
    setPushActive,
    initializeConfiguration,
  ]);

  /**
   * Turns push on for this browser (asks for permission if needed). Runs straight from the
   * switch click because browsers only allow the permission prompt from a user gesture.
   */
  const enableBrowserPush = React.useCallback(async () => {
    if (!initialized) {
      return false;
    }
    setError(null);
    try {
      if (!OneSignal.Notifications.permission) {
        await OneSignal.Slidedown.promptPush({ force: true });
      }
      if (
        OneSignal.Notifications.permission &&
        !OneSignal.User.PushSubscription.optedIn
      ) {
        await OneSignal.User.PushSubscription.optIn();
      }
    } catch (err) {
      console.warn('Failed to enable browser push', err);
    }
    const active = isPushActive();
    setPushActive(active);
    if (!active) {
      setError(
        'Notifications are blocked for this browser. Allow them from the padlock icon next to the address bar, then try again.',
      );
    }
    return active;
  }, [OneSignal, initialized, setError, setPushActive]);
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
        // Push is per device: switching it off only opts THIS browser out. The user-level `push`
        // tag is left alone so the user's other devices keep receiving; switching on clears any
        // earlier `disabled` marker.
        if (configuration.browserNotifications) {
          if (
            OneSignal.Notifications.permission &&
            !OneSignal.User.PushSubscription.optedIn
          ) {
            await OneSignal.User.PushSubscription.optIn();
          }
          await writePreferenceTag(TAG_PUSH, true);
        } else if (OneSignal.User.PushSubscription.optedIn) {
          await OneSignal.User.PushSubscription.optOut();
        }
        setPushActive(isPushActive());

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
    [OneSignal, initialized, person, isLoading, setPushActive],
  );

  return {
    subscribed,
    pushActive,
    subscribe,
    unsubscribe,
    enableBrowserPush,
    configuration,
    setConfiguration,
    saveConfigurations,
    error,
  };
};
