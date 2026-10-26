'use client';

import { useEffect, useState } from 'react';
import {
  HumanChatPanelErrorBoundary,
  HumanRightPanel,
  useIsNetworkContext,
  useIsSpaceContext,
} from '@hypha-platform/epics';
import { useSidebar } from '@hypha-platform/ui';
import { useMembers } from '@web/hooks/use-members';

export function ConnectedHumanRightPanel() {
  const { open, openMobile } = useSidebar();
  const isSpace = useIsSpaceContext();
  const isNetwork = useIsNetworkContext();
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (open || openMobile) {
      setHasOpened(true);
    } else if (!isSpace && !isNetwork) {
      setHasOpened(false);
    }
  }, [open, openMobile, isSpace, isNetwork]);

  if (!hasOpened) {
    return null;
  }

  return (
    <HumanChatPanelErrorBoundary>
      <HumanRightPanel useMembers={useMembers} />
    </HumanChatPanelErrorBoundary>
  );
}
