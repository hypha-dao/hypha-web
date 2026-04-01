'use client';

import { createContext, useCallback, useContext, useState } from 'react';

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

export type HumanChatPanelContextValue = {
  open: boolean;
  toggle: () => void;
  // Coherence mode
  mode: 'space' | 'coherence';
  coherenceRoomId: string | null;
  coherenceTitle: string | null;
  coherenceSlug: string | null;
  openCoherenceChat: (roomId: string, title: string, slug: string) => void;
  closeCoherenceChat: () => void;
};

const HumanChatPanelContext = createContext<HumanChatPanelContextValue>({
  open: false,
  toggle: () => {},
  mode: 'space',
  coherenceRoomId: null,
  coherenceTitle: null,
  coherenceSlug: null,
  openCoherenceChat: () => {},
  closeCoherenceChat: () => {},
});

/**
 * Stateful provider for the Human Chat Panel.
 * Accepts `open` and `toggle` from the parent (sidebar state),
 * and manages coherence mode state internally.
 */
export function HumanChatPanelProvider({
  children,
  open,
  toggle,
}: {
  children: React.ReactNode;
  open: boolean;
  toggle: () => void;
}) {
  const [mode, setMode] = useState<'space' | 'coherence'>('space');
  const [coherenceRoomId, setCoherenceRoomId] = useState<string | null>(null);
  const [coherenceTitle, setCoherenceTitle] = useState<string | null>(null);
  const [coherenceSlug, setCoherenceSlug] = useState<string | null>(null);

  const openCoherenceChat = useCallback(
    (roomId: string, title: string, slug: string) => {
      setCoherenceRoomId(roomId);
      setCoherenceTitle(title);
      setCoherenceSlug(slug);
      setMode('coherence');
      // Also open the sidebar panel if it's closed
      if (!open) {
        toggle();
      }
    },
    [open, toggle],
  );

  const closeCoherenceChat = useCallback(() => {
    setMode('space');
    setCoherenceRoomId(null);
    setCoherenceTitle(null);
    setCoherenceSlug(null);
  }, []);

  return (
    <HumanChatPanelContext.Provider
      value={{
        open,
        toggle,
        mode,
        coherenceRoomId,
        coherenceTitle,
        coherenceSlug,
        openCoherenceChat,
        closeCoherenceChat,
      }}
    >
      {children}
    </HumanChatPanelContext.Provider>
  );
}

export function useHumanChatPanel(): HumanChatPanelContextValue {
  return useContext(HumanChatPanelContext);
}
