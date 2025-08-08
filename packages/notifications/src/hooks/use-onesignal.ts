'use client';

import { useEffect, useRef } from 'react';
import { type IOneSignalOneSignal } from 'react-onesignal';

export function useOnesignal() {
  const onesignal = useRef<IOneSignalOneSignal | undefined>(undefined);

  useEffect(() => {
    // FIXME: feels weird
    const checkOneSignal = () => {
      if (window !== undefined && window?.OneSignal) {
        onesignal.current = window.OneSignal;
      } else {
        setTimeout(checkOneSignal, 100);
      }
    };

    checkOneSignal();
  }, []);

  return { onesignal: onesignal.current };
}
