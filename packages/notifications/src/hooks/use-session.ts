'use client';

import { useRef } from 'react';
import { useOnesignal } from './use-onesignal';
import OneSignal from 'react-onesignal';

export function useSession() {
  const { onesignal } = useOnesignal();

  const sessionId = useRef(onesignal?.User?.onesignalId);
  const userId = useRef(onesignal?.User?.externalId);

  /**
   * @brief Links current client session to a unique user
   */
  const linkToUser = (userId: string) => {
    window.OneSignalDeferred = window.OneSignalDeferred ?? [];

    window.OneSignalDeferred.push(async () => await OneSignal.login(userId));
  };

  /**
   * @brief Unlinks current client session from a user (for example,
   *        when the user is logging out)
   */
  const unlinkFromUser = () => {
    window.OneSignalDeferred = window.OneSignalDeferred ?? [];

    window.OneSignalDeferred.push(async () => await OneSignal.logout());
  };

  return {
    sessionId: sessionId.current,
    userId: userId.current,
    linkToUser,
    unlinkFromUser,
  };
}
