'use client';

import { useState, useEffect } from 'react';
import OneSignal from 'react-onesignal';

const useOneSignalState = (effect: () => Promise<void>) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    effect()
      .catch((err) =>
        setError(err instanceof Error ? err : new Error(String(err))),
      )
      .finally(() => setIsLoading(false));
  }, [effect]);

  return { isLoading, error };
};

export function useSession() {
  /**
   * @brief Links current client session to a unique user
   */
  const linkToUser = (userId: string) => {
    return useOneSignalState(() => OneSignal.login(userId));
  };

  /**
   * @brief Unlinks current client session from a user (for example, when
   *        when the user is logging out)
   */
  const unlinkFromUser = () => {
    return useOneSignalState(OneSignal.logout);
  };

  return { linkToUser, unlinkFromUser };
}

/**
 * @brief Get current session IDs
 */
export function useCurrentSession() {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const { onesignalId, externalId } = OneSignal.User;

    setSessionId(onesignalId);
    setUserId(externalId);
  }, [OneSignal.User]);

  return { sessionId, userId };
}
