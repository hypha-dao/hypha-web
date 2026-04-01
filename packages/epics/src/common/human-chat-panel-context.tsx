'use client';

import { createContext, useContext } from 'react';

/**
 * Shared panel context type used by both AI and Human panel triggers.
 * This decouples triggers from SidebarProvider nesting so they can be
 * placed anywhere in the component tree.
 */
export type PanelContextValue = {
  open: boolean;
  toggle: () => void;
};

// ─── AI Panel Context ────────────────────────────────────────────────────────

const AiPanelContext = createContext<PanelContextValue>({
  open: false,
  toggle: () => {},
});

export const AiPanelProvider = AiPanelContext.Provider;

export function useAiPanel() {
  return useContext(AiPanelContext);
}

// ─── Human Chat Panel Context ────────────────────────────────────────────────

const HumanChatPanelContext = createContext<PanelContextValue>({
  open: false,
  toggle: () => {},
});

export const HumanChatPanelProvider = HumanChatPanelContext.Provider;

export function useHumanChatPanel() {
  return useContext(HumanChatPanelContext);
}
