'use client';

import React, { useCallback, useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarResizeHandle,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import {
  AiPanelProvider,
  HumanChatPanelProvider,
  useAiPanel,
  useHumanChatPanel,
} from './human-chat-panel-context';

// ─── Trigger Buttons ─────────────────────────────────────────────────────────
// Both triggers use custom contexts (not useSidebar()) so they work correctly
// regardless of SidebarProvider nesting order.

export function AiSidebarTrigger() {
  const { open, toggle } = useAiPanel();
  const t = useTranslations('AiPanel');

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={open ? t('hidePanel') : t('openPanel')}
      aria-label={open ? t('hidePanel') : t('openPanel')}
    >
      <Sparkles className="h-4 w-4" />
    </button>
  );
}

export function HumanSidebarTrigger() {
  const { open, toggle } = useHumanChatPanel();
  const t = useTranslations('HumanChatPanel');

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={open ? t('hidePanel') : t('openPanel')}
      aria-label={open ? t('hidePanel') : t('openPanel')}
    >
      <MessageCircle className="h-4 w-4" />
    </button>
  );
}

// ─── Panel Slot Types ────────────────────────────────────────────────────────

type PanelSlot = {
  content: React.ReactNode;
};

type PanelWrapLayoutProps = {
  children: React.ReactNode;
  left?: PanelSlot;
  right?: PanelSlot;
};

// ─── Main Layout ─────────────────────────────────────────────────────────────
// Uses two nested SidebarProviders in controlled mode. Custom contexts ensure
// that AiSidebarTrigger and HumanSidebarTrigger always toggle the correct panel
// regardless of where they are rendered in the tree.
//
// Nesting order (outer → inner):
//   AiPanelProvider → LEFT SidebarProvider → HumanChatPanelProvider → RIGHT SidebarProvider
//
// Children live inside the innermost SidebarInset and can use either custom
// context via the exported trigger components.

export function PanelWrapLayout({
  children,
  left,
  right,
}: PanelWrapLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const toggleLeft = useCallback(() => setLeftOpen((prev) => !prev), []);
  const toggleRight = useCallback(() => setRightOpen((prev) => !prev), []);

  // Core content that goes inside the innermost SidebarInset
  let content = <>{children}</>;

  // Wrap with right panel if provided
  if (right) {
    content = (
      <HumanChatPanelProvider open={rightOpen} toggle={toggleRight}>
        <SidebarProvider
          open={rightOpen}
          onOpenChange={setRightOpen}
          style={
            {
              '--sidebar-width': '320px',
            } as React.CSSProperties
          }
        >
          <SidebarInset>{content}</SidebarInset>
          <Sidebar side="right" variant="sidebar" collapsible="offcanvas">
            <SidebarResizeHandle />
            {right.content}
          </Sidebar>
        </SidebarProvider>
      </HumanChatPanelProvider>
    );
  }

  // Wrap with left panel if provided
  if (left) {
    content = (
      <AiPanelProvider value={{ open: leftOpen, toggle: toggleLeft }}>
        <SidebarProvider
          open={leftOpen}
          onOpenChange={setLeftOpen}
          style={
            {
              '--sidebar-width': '320px',
            } as React.CSSProperties
          }
        >
          <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
            {left.content}
            <SidebarResizeHandle />
          </Sidebar>
          <SidebarInset>{content}</SidebarInset>
        </SidebarProvider>
      </AiPanelProvider>
    );
  }

  return content;
}
