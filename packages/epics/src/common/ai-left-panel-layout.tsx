'use client';

/**
 * @deprecated Use `PanelWrapLayout` and `AiSidebarTrigger` from `./panel-wrap-layout` instead.
 * This file is kept for backward compatibility.
 */

import React from 'react';
import { AiSidebarTrigger, PanelWrapLayout } from './panel-wrap-layout';
import { AiLeftPanel } from './ai-left-panel';

export { AiSidebarTrigger };

type AiLeftPanelLayoutProps = {
  children: React.ReactNode;
  enabled?: boolean;
};

/**
 * @deprecated Use `PanelWrapLayout` with the `left` slot prop instead.
 */
export function AiLeftPanelLayout({
  children,
  enabled = false,
}: AiLeftPanelLayoutProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <PanelWrapLayout left={{ content: <AiLeftPanel /> }}>
      {children}
    </PanelWrapLayout>
  );
}
