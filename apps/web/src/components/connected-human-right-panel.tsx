'use client';

import { useEffect, useState } from 'react';
import { HumanRightPanel } from '@hypha-platform/epics';
import { useSidebar } from '@hypha-platform/ui';
import { useMembers } from '@web/hooks/use-members';

export function ConnectedHumanRightPanel() {
  const { open } = useSidebar();
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (open) {
      setHasOpened(true);
    }
  }, [open]);

  if (!hasOpened) {
    return null;
  }

  return <HumanRightPanel useMembers={useMembers} />;
}
