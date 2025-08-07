'use client';

import { useState, useEffect } from 'react';
import OneSignal from 'react-onesignal';

export function useSession() {
  /**
   * @brief Links current client session to a unique user
   */
  const linkToUser = (userId: string) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | undefined>(undefined);

    useEffect(() => {
      OneSignal.login(userId)
        .catch((err) =>
          setError(err instanceof Error ? err : new Error(String(err))),
        )
        .finally(() => setIsLoading(false));
    }, [userId]);

    return { isLoading, error };
  };

  /**
   * @brief Unlinks current client session from a user (for example, when
   *        when the user is logging out)
   */
  const unlinkFromUser = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | undefined>(undefined);

    useEffect(() => {
      OneSignal.logout()
        .catch((err) =>
          setError(err instanceof Error ? err : new Error(String(err))),
        )
        .finally(() => setIsLoading(false));
    }, []);

    return { isLoading, error };
  };

  /**
   * @brief Get current session IDs
   */
  const currentSession = () => {
    const { onesignalId: sessionId, externalId: userId } = OneSignal.User;

    return { sessionId, userId };
  };

  return { currentSession, linkToUser, unlinkFromUser };
}
