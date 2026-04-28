'use client';

import { AiLeftPanel } from './ai-left-panel';
import { useAiPanel } from './human-chat-panel-context';
import { SpaceLeftMenuPanel } from './space-left-menu-panel';

export function SpaceLeftPanel() {
  const { contentMode } = useAiPanel();

  if (contentMode === 'ai') {
    return <AiLeftPanel />;
  }

  return <SpaceLeftMenuPanel />;
}
