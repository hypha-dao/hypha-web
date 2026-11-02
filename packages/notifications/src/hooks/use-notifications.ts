'use client';

import { Person } from '@hypha-platform/core/client';
import React from 'react';
import OneSignal from 'react-onesignal';
import {
  isTagDisabled,
  SubscriptionTag,
  Tag,
  TAG_SUBSCRIBED,
} from '../constants';
import {
  enrolNotificationsAction,
  getNotificationPreferencesAction,
  saveNotificationPreferencesAction,
  unenrolNotificationsAction,
} from '../actions/notification-preferences';
import type { NotificationPreferences } from '../core/preferences';

const TRUE = 'true';

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
  getAccessToken,
}: {
  person: Person | undefined;
  isLoading: boolean;
  /** Privy access token for the server actions that read and write the settings. */
  getAccessToken: () => Promise<string | null>;
}) => {
  const {
    initialized,
    subscribed: sdkSubscribed,
    setSubscribed,
    pushActive,
    setPushActive,
  } = React.useContext(NotificationsContext);
  const [error, setError] = React.useState<string | null>(null);
  const [preferences, setPreferences] =
    React.useState<NotificationPreferences>();
  const [configuration, setConfiguration] =
    React.useState<NotificationConfiguration>();
  const personSlug = person?.slug;

  /** Preferences live on the server (#2611); the SDK is only used for this browser's push state. */
  const applyPreferences = React.useCallback(
    (prefs: NotificationPreferences) => {
      setPreferences(prefs);
      setSubscribed(prefs.subscribed);
      setConfiguration({
        // The form ANDs this with `pushActive`: push is per browser, the tag is per user.
        browserNotifications: prefs.pushTagEnabled,
        emailNotifications: prefs.emailEnabled,
        subscriptions: prefs.subscriptions,
      });
    },
    [setSubscribed],
  );

  const withToken = React.useCallback(async () => {
    const authToken = await getAccessToken();
    if (!authToken) {
      throw new Error('No access token available');
    }
    return { authToken };
  }, [getAccessToken]);

  React.useEffect(() => {
    if (!personSlug) {
      setPreferences(undefined);
      setConfiguration(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const prefs = await getNotificationPreferencesAction(await withToken());
        if (!cancelled) applyPreferences(prefs);
      } catch (err) {
        console.warn('Failed to load notification settings', err);
        if (!cancelled) setError('Could not load notification settings.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personSlug, withToken, applyPreferences]);

  const subscribe = React.useCallback(async () => {
    setError(null);
    try {
      // Enrolment is account-level: a declined browser prompt, or a browser where the SDK
      // can't run, must not block it (email still works) - push just stays off here.
      if (initialized) {
        try {
          await OneSignal.Slidedown.promptPush({ force: true });
        } catch (promptErr) {
          console.warn('Push prompt declined:', promptErr);
        }
        setPushActive(isPushActive());
      }
      // The server also starts own-action confirmations switched off (#2549 D5) without
      // overwriting a choice the person already made.
      applyPreferences(await enrolNotificationsAction(await withToken()));
    } catch (err) {
      console.warn('Error:', err);
      setError('Could not turn notifications on. Please try again.');
    }
  }, [initialized, setPushActive, applyPreferences, withToken]);

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
  }, [initialized, setError, setPushActive]);

  const unsubscribe = React.useCallback(async () => {
    setError(null);
    try {
      applyPreferences(await unenrolNotificationsAction(await withToken()));
    } catch (err) {
      console.warn('Error:', err);
      setError('Could not turn notifications off. Please try again.');
    }
  }, [applyPreferences, withToken]);

  const saveConfigurations = React.useCallback(
    async (configuration: NotificationConfiguration) => {
      if (isLoading || !person) {
        console.warn(
          'Cannot save notification settings while user data is loading',
        );
        return;
      }
      setError(null);
      try {
        // Push is per device: switching it off only opts THIS browser out (when the SDK is
        // available). The user-level `push` tag is left alone so the user's other devices keep
        // receiving; switching on clears any earlier `disabled` marker.
        if (initialized) {
          if (configuration.browserNotifications) {
            if (
              OneSignal.Notifications.permission &&
              !OneSignal.User.PushSubscription.optedIn
            ) {
              await OneSignal.User.PushSubscription.optIn();
            }
          } else if (OneSignal.User.PushSubscription.optedIn) {
            await OneSignal.User.PushSubscription.optOut();
          }
          setPushActive(isPushActive());
        }

        applyPreferences(
          await saveNotificationPreferencesAction(
            {
              ...(configuration.browserNotifications
                ? { pushTagEnabled: true }
                : {}),
              emailEnabled: configuration.emailNotifications,
              subscriptions: configuration.subscriptions,
            },
            await withToken(),
          ),
        );
      } catch (err) {
        console.warn('Failed to save notification configuration', err);
        setError('Could not save notification settings. Please try again.');
      }
    },
    [
      initialized,
      person,
      isLoading,
      setPushActive,
      applyPreferences,
      withToken,
    ],
  );

  return {
    // Server value once loaded; the SDK-derived context value only as a fallback.
    subscribed: preferences ? preferences.subscribed : sdkSubscribed,
    pushActive,
    /** This browser's push state (permission/subscription) comes from the SDK and may never be ready. */
    pushStateReady: initialized,
    subscribe,
    unsubscribe,
    enableBrowserPush,
    configuration,
    setConfiguration,
    saveConfigurations,
    error,
  };
};
