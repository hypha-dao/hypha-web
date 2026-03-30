'use client';

import { Sparkles } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarResizeHandle,
  useSidebar,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { AiLeftPanel } from './ai-left-panel';

type AiLeftPanelLayoutProps = {
  children: React.ReactNode;
  enabled?: boolean;
};

export function AiSidebarTrigger() {
  const { toggleSidebar, open } = useSidebar();
  const t = useTranslations('AiPanel');

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={open ? t('hidePanel') : t('openPanel')}
      aria-label={open ? t('hidePanel') : t('openPanel')}
    >
      <Sparkles className="h-4 w-4" />
    </button>
  );
}

export function AiLeftPanelLayout({
  children,
  enabled = false,
}: AiLeftPanelLayoutProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          '--sidebar-width': '320px',
        } as React.CSSProperties
      }
    >
      <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
        <AiLeftPanel />
        <SidebarResizeHandle />
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
