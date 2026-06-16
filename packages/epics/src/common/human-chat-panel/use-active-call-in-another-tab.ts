'use client';

import { useEffect, useState } from 'react';
import {
  isGroupCallSessionActive,
  isRemoteGroupCallHoldActive,
  subscribeGroupCallSessionActive,
} from '@hypha-platform/core/client';

/** True when another tab holds the live group-call session (CSH-MESH-5). */
export function useActiveCallInAnotherTab(): boolean {
  const [active, setActive] = useState(
    () => isRemoteGroupCallHoldActive() && !isGroupCallSessionActive(),
  );

  useEffect(() => {
    const update = () => {
      setActive(isRemoteGroupCallHoldActive() && !isGroupCallSessionActive());
    };
    update();
    return subscribeGroupCallSessionActive(update);
  }, []);

  return active;
}
