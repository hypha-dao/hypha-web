'use client';

import { useEffect, useState } from 'react';
import { HumanRightPanel, useIsSpaceContext } from '@hypha-platform/epics';
import { useSidebar } from '@hypha-platform/ui';
import { useMembers } from '@web/hooks/use-members';

export function ConnectedHumanRightPanel() {
  const { open } = useSidebar();
  const isSpace = useIsSpaceContext();
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (open) {
      setHasOpened(true);
    } else if (!isSpace) {
      setHasOpened(false);
    }
  }, [open, isSpace]);

  if (!hasOpened) {
    return null;
  }

  return <HumanRightPanel useMembers={useMembers} />;
}
