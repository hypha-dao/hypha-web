'use client';

import * as React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarResizeHandle,
} from '@hypha-platform/ui';
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
      open={leftOpen}
      onOpenChange={onLeftOpenChange}
      style={
        {
          '--sidebar-width': '320px',
        } as React.CSSProperties
      }
    >
      <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
        {leftContent}
        <SidebarResizeHandle />
      </Sidebar>
      <SidebarInset ref={bindScrollRoot} className="overflow-y-auto">
        <SidebarProvider
          open={rightOpen}
          onOpenChange={onRightOpenChange}
          style={
            {
              '--sidebar-width': '320px',
            } as React.CSSProperties
          }
        >
          {children}
          <Sidebar side="right" variant="sidebar" collapsible="offcanvas">
            <SidebarResizeHandle />
            {rightContent}
          </Sidebar>
        </SidebarProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
