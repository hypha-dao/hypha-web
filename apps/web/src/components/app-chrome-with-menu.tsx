'use client';

import {
  AiSidebarTrigger,
  ConnectedButtonProfile,
  HumanSidebarTrigger,
} from '@hypha-platform/epics';
import { MenuTop, type ButtonNavItemProps } from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe } from '@hypha-platform/core/client';
import { ConnectedLanguageSelect } from '@web/components/connected-language-select';
import { ROOT_URL } from '@web/app/constants';
import type { ReactNode } from 'react';

import { useMenuBreadcrumbSlot } from './menu-breadcrumb-context';

type AppChromeWithMenuProps = {
  openMenuLabel: string;
  closeMenuLabel: string;
  aiChatEnabled: boolean;
  humanChatEnabled: boolean;
  isLanguageSelectVisible: boolean;
  navItems: ButtonNavItemProps[];
  children: ReactNode;
};

export function AppChromeWithMenu({
  openMenuLabel,
  closeMenuLabel,
  aiChatEnabled,
  humanChatEnabled,
  isLanguageSelectVisible,
  navItems,
  children,
}: AppChromeWithMenuProps) {
  const breadcrumbSlot = useMenuBreadcrumbSlot();

  return (
    <>
      <div className="sticky top-0 z-30 shrink-0">
        <MenuTop
          logoHref={ROOT_URL}
          breadcrumbSlot={breadcrumbSlot ?? undefined}
          openMenuLabel={openMenuLabel}
          closeMenuLabel={closeMenuLabel}
          leadingAction={aiChatEnabled ? <AiSidebarTrigger /> : undefined}
          trailingAction={
            humanChatEnabled ? <HumanSidebarTrigger /> : undefined
          }
        >
          <ConnectedButtonProfile
            useAuthentication={useAuthentication}
            useMe={useMe}
            newUserRedirectPath="/profile/signup"
            baseRedirectPath="/my-spaces"
            navItems={navItems}
          />
          {isLanguageSelectVisible && <ConnectedLanguageSelect />}
        </MenuTop>
      </div>
      {children}
    </>
  );
}
