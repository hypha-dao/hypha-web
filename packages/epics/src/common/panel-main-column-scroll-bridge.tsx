'use client';

import * as React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarResizeHandle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID } from '@hypha-platform/core/client';
import { setMainColumnScrollRoot } from './main-column-scroll';

type Props = {
  leftOpen: boolean;
  leftPanelOpen: boolean;
  leftSidebarWidth: string;
  /** Pixels of persistent icon rail included in the left sidebar width. */
  leftIconRailPx?: number;
  onLeftOpenChange: (open: boolean) => void;
  rightOpen: boolean;
  onRightOpenChange: (open: boolean) => void;
  rightSidebarWidth: string;
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
  leftPanelOpen,
  leftSidebarWidth,
  leftIconRailPx = 0,
  onLeftOpenChange,
  rightOpen,
  onRightOpenChange,
  rightSidebarWidth,
  leftContent,
  rightContent,
  children,
}: Props) {
  const setMainColumnRef = React.useCallback((node: HTMLElement | null) => {
    setMainColumnScrollRoot(node);
  }, []);

  return (
    <SidebarProvider
      defaultOpen={false}
      open={leftOpen}
      onOpenChange={onLeftOpenChange}
      style={
        {
          '--sidebar-width': leftSidebarWidth,
          '--sidebar-width-icon': '72px',
        } as React.CSSProperties
      }
    >
      <Sidebar
        side="left"
        variant="sidebar"
        collapsible="icon"
        mobileWidth={leftOpen ? '100vw' : undefined}
        className="z-[50] overflow-visible"
      >
        {leftContent}
        <SidebarResizeHandle
          minWidth={280 + leftIconRailPx}
          maxWidth={600 + leftIconRailPx}
          defaultWidth={320 + leftIconRailPx}
        />
      </Sidebar>
      {/*
        The inner `SidebarProvider` is `h-svh` and lays out the center column + right panel in
        a row. Scrolling must happen *inside* that row’s center column — not on this outer
        `SidebarInset`. Otherwise the scrollable height equals the viewport, nothing overflows
        here, and the real scroll moves to an ancestor/window, breaking `setMainColumnScrollRoot`
        and DHO sticky chrome (fixed bar + opacity) that subscribe to the main column.
      */}
      <SidebarInset
        className={cn(
          'craft-page-canvas min-h-0 flex-1 flex-col overflow-hidden',
        )}
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
              '--sidebar-width': rightSidebarWidth,
            } as React.CSSProperties
          }
        >
          {/*
            `SidebarProvider` is `display: flex` (row). The root layout passes several siblings
            (MenuTop, plugin, main, Footer) as a fragment — fragments flatten, so without this
            wrapper they become **separate flex items** next to the right Sidebar: header | content
            | footer | panel in one horizontal row.
            `overflow-x-hidden`: Human/AI panels are `position:fixed`; clip horizontal pan so the
            scrollport cannot reveal a dead gap beside the fixed rails.
            `overscroll-none`: at scrollTop 0 the macOS rubber-band pulls in-flow content
            (the space banner) away from the sticky top menu and shows a strip of the page
            between them. The menu stays pinned; the banner must not.
          */}
          <div
            id={HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID}
            ref={setMainColumnRef}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-none narrow-scrollbar"
          >
            {children}
          </div>
          <Sidebar
            side="right"
            variant="sidebar"
            collapsible="offcanvas"
            mobileWidth="100vw"
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
