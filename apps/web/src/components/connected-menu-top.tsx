'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MenuTop } from '@hypha-platform/ui';
import { useAiPanel } from '@hypha-platform/epics';

type ConnectedMenuTopProps = {
  children?: ReactNode;
  leadingAction?: ReactNode;
  trailingAction?: ReactNode;
  logoHref?: string;
  hrefTarget?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
  aiChatEnabled: boolean;
};

export function ConnectedMenuTop({
  children,
  leadingAction,
  trailingAction,
  logoHref,
  hrefTarget,
  openMenuLabel,
  closeMenuLabel,
  aiChatEnabled,
}: ConnectedMenuTopProps) {
  const pathname = usePathname();
  const { open: isAiOpen } = useAiPanel();
  const isSpaceRoute = /^\/[^/]+\/dho\/[^/]+/.test(pathname);
  const hideLogo = aiChatEnabled && isSpaceRoute && !isAiOpen;

  return (
    <MenuTop
      logoHref={hideLogo ? undefined : logoHref}
      hrefTarget={hrefTarget}
      openMenuLabel={openMenuLabel}
      closeMenuLabel={closeMenuLabel}
      leadingAction={leadingAction}
      trailingAction={trailingAction}
    >
      {children}
    </MenuTop>
  );
}
