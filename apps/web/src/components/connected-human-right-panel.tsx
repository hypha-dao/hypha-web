'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  HumanChatPanelErrorBoundary,
  HumanRightPanel,
  useHumanChatPanel,
  useIsNetworkContext,
  useIsSpaceContext,
} from '@hypha-platform/epics';
import { useSidebar } from '@hypha-platform/ui';
import { useMembers } from '@web/hooks/use-members';

function isSpaceChatDeepLink(value: string | null | undefined): boolean {
  const raw = value?.trim();
  return raw === 'space' || raw === 'ecosystem' || raw === 'public';
}

export function ConnectedHumanRightPanel() {
  const { open: sidebarOpen, openMobile } = useSidebar();
  const { open: contextOpen } = useHumanChatPanel();
  const isSpace = useIsSpaceContext();
  const isNetwork = useIsNetworkContext();
  const searchParams = useSearchParams();
  const hasSpaceChatDeepLink = isSpaceChatDeepLink(
    searchParams?.get('spaceChat'),
  );
  const [hasOpened, setHasOpened] = useState(false);
  const panelOpen = sidebarOpen || openMobile || contextOpen;

  useEffect(() => {
    // `?spaceChat=` must mount the panel so HumanRightPanel can open the space
    // room — otherwise the lazy gate leaves the side panel closed.
    if (panelOpen || hasSpaceChatDeepLink) {
      setHasOpened(true);
    } else if (!isSpace && !isNetwork) {
      setHasOpened(false);
    }
  }, [panelOpen, isSpace, isNetwork, hasSpaceChatDeepLink]);

  if (!hasOpened && !hasSpaceChatDeepLink) {
    return null;
  }

  return (
    <HumanChatPanelErrorBoundary>
      <HumanRightPanel useMembers={useMembers} />
    </HumanChatPanelErrorBoundary>
  );
}
