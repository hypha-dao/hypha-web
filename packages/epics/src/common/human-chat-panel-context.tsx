'use client';

import { createContext, useCallback, useContext, useState } from 'react';

/**
 * Shared panel context type used by both AI and Human panel triggers.
 * This decouples triggers from SidebarProvider nesting so they can be
 * placed anywhere in the component tree.
 */
export type PanelContextValue = {
  open: boolean;
  overlayVisible: boolean;
  toggle: () => void;
  /** Idempotently expands the AI sidebar without toggling it closed. */
  openAiPanel: () => void;
  /** Idempotently collapses the AI sidebar without toggling it open. */
  closeAiPanel: () => void;
  /** Shows AI overlay without changing collapsed/expanded intent. */
  showAiOverlay: () => void;
  /** Hides AI overlay without changing collapsed/expanded intent. */
  hideAiOverlay: () => void;
};

// ─── AI Panel Context ────────────────────────────────────────────────────────

const AiPanelContext = createContext<PanelContextValue>({
  open: false,
  overlayVisible: false,
  toggle: () => {},
  openAiPanel: () => {},
  closeAiPanel: () => {},
  showAiOverlay: () => {},
  hideAiOverlay: () => {},
});

export const AiPanelProvider = AiPanelContext.Provider;

export function useAiPanel() {
  return useContext(AiPanelContext);
}

// ─── Human Chat Panel Context ────────────────────────────────────────────────

export type HumanChatPanelContextValue = {
  open: boolean;
  toggle: () => void;
  /** Opens the Human Chat sidebar (right panel) without toggling closed if already open. */
  openHumanChatPanel: () => void;
  // Coherence mode
  mode: 'space' | 'coherence';
  coherenceRoomId: string | null;
  coherenceTitle: string | null;
  coherenceSlug: string | null;
  openCoherenceChat: (
    roomId: string | null,
    title: string,
    slug: string,
  ) => void;
  closeCoherenceChat: () => void;
};

const HumanChatPanelContext = createContext<HumanChatPanelContextValue>({
  open: false,
  toggle: () => {},
  openHumanChatPanel: () => {},
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
  setOpen,
}: {
  children: React.ReactNode;
  open: boolean;
  toggle: () => void;
  setOpen: (value: boolean) => void;
}) {
  const [mode, setMode] = useState<'space' | 'coherence'>('space');
  const [coherenceRoomId, setCoherenceRoomId] = useState<string | null>(null);
  const [coherenceTitle, setCoherenceTitle] = useState<string | null>(null);
  const [coherenceSlug, setCoherenceSlug] = useState<string | null>(null);

  const openCoherenceChat = useCallback(
    (roomId: string | null, title: string, slug: string) => {
      setCoherenceRoomId(roomId);
      setCoherenceTitle(title);
      setCoherenceSlug(slug);
      setMode('coherence');
      // Idempotently open the sidebar — avoids race condition with toggle()
      setOpen(true);
    },
    [setOpen],
  );

  const closeCoherenceChat = useCallback(() => {
    setMode('space');
    setCoherenceRoomId(null);
    setCoherenceTitle(null);
    setCoherenceSlug(null);
  }, []);

  const openHumanChatPanel = useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  return (
    <HumanChatPanelContext.Provider
      value={{
        open,
        toggle,
        openHumanChatPanel,
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
