'use client';

import { useEffect, useState } from 'react';
import { HumanRightPanel } from '@hypha-platform/epics';
import { useSidebar } from '@hypha-platform/ui';
import { useMembers } from '@web/hooks/use-members';

export function ConnectedHumanRightPanel() {
  const { open } = useSidebar();
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    console.log(
      `[DEBUG ConnectedHumanRightPanel] Mounted — sidebar open=${open}`,
    );
    return () => {
      console.log('[DEBUG ConnectedHumanRightPanel] Unmounted');
    };
    // intentionally empty — only runs on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log(
      `[DEBUG ConnectedHumanRightPanel] sidebar open changed — open=${open} hasOpened=${hasOpened}`,
    );
    if (open) {
      setHasOpened(true);
    }
  }, [open]);

  console.log(
    `[DEBUG ConnectedHumanRightPanel] render — open=${open} hasOpened=${hasOpened}`,
  );

  if (!hasOpened) {
    return null;
  }

  return <HumanRightPanel useMembers={useMembers} />;
}
