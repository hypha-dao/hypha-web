'use client';

import * as React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarResizeHandle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { setMainColumnScrollRoot } from './main-column-scroll';

type Props = {
  leftOpen: boolean;
  onLeftOpenChange: (open: boolean) => void;
  rightOpen: boolean;
  onRightOpenChange: (open: boolean) => void;
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Single scroll container when both AI and Human panels are enabled, so parallax and
 * sticky DHO chrome see one scroll root instead of nested `overflow-y-auto` insets.
 *
 * Sidebars use `z-[50]` so they sit above `ProposalOverlayShell` scrim (`z-40`).
 */
export function PanelDualSidebarScrollBridge({
  leftOpen,
  onLeftOpenChange,
  rightOpen,
  onRightOpenChange,
  leftContent,
  rightContent,
  children,
}: Props) {
  const bindScrollRoot = React.useCallback((node: HTMLElement | null) => {
    setMainColumnScrollRoot(node);
  }, []);

  return (
    <SidebarProvider
      defaultOpen={false}
      open={leftOpen}
      onOpenChange={onLeftOpenChange}
      style={
        {
          '--sidebar-width': '320px',
        } as React.CSSProperties
      }
    >
      <Sidebar
        side="left"
        variant="sidebar"
        collapsible="offcanvas"
        className="z-[50]"
      >
        {leftContent}
        <SidebarResizeHandle />
      </Sidebar>
      <SidebarInset
        ref={bindScrollRoot}
        className={cn('overflow-y-auto narrow-scrollbar')}
        style={
          {
            '--main-column-scrollbar-width': '0px',
          } as React.CSSProperties
        }
      >
        <SidebarProvider
          defaultOpen={false}
          open={rightOpen}
          onOpenChange={onRightOpenChange}
          style={
            {
              '--sidebar-width': '320px',
            } as React.CSSProperties
          }
        >
          {/*
            `SidebarProvider` is `display: flex` (row). The root layout passes several siblings
            (MenuTop, plugin, main, Footer) as a fragment — fragments flatten, so without this
            wrapper they become **separate flex items** next to the right Sidebar: header | content
            | footer | panel in one horizontal row.
          */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
          <Sidebar
            side="right"
            variant="sidebar"
            collapsible="offcanvas"
            className="z-[50]"
          >
            <SidebarResizeHandle />
            {rightContent}
          </Sidebar>
        </SidebarProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
