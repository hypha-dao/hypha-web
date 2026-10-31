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
  /** Sets AI overlay visibility immediately without transition delay. */
  setAiOverlayVisible: (visible: boolean) => void;
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
  setAiOverlayVisible: () => {},
});

export const AiPanelProvider = AiPanelContext.Provider;

export function useAiPanel() {
  return useContext(AiPanelContext);
}

// ─── Human Chat Panel Context ────────────────────────────────────────────────

/**
 * Space picked on the network map. `roomId` may be the member room
 * (`spaces.chatRoomId`); map chat entry points must open the public
 * channel via `useOpenSpacePublicChat` and the slug, not this id.
 */
export type FocusedSpaceChat = {
  roomId: string | null;
  title: string;
  slug: string;
  description: string | null;
};

/** Peer in a person-to-person room — drives the chat header avatar. */
export type CoherencePeerPerson = {
  slug: string;
  address?: string | null;
  id?: number;
};

/**
 * Non-DM channel opened from Messages. Distinguishes space / ecosystem /
 * network headers from person-to-person chats that also use an empty slug.
 */
export type CoherenceOpenedChannel =
  | 'space'
  | 'space-public'
  | 'ecosystem'
  | 'network'
  | 'signal'
  | 'proposal';

export type OpenCoherenceChatOptions = {
  public?: boolean;
  peerPerson?: CoherencePeerPerson | null;
  channel?: CoherenceOpenedChannel | null;
};

export type HumanChatPanelContextValue = {
  open: boolean;
  toggle: () => void;
  /** Opens the Human Chat sidebar (right panel) without toggling closed if already open. */
  openHumanChatPanel: () => void;
  /** Idempotently closes the Human Chat sidebar without toggling it open. */
  closeHumanChatPanel: () => void;
  /** Aggregate unread @mention count across joined rooms (for header badge). */
  unreadMentionCount: number;
  /** Publish unread mention count from the mounted chat panel. */
  setUnreadMentionCount: (count: number) => void;
  /** Space currently selected on the network. Null when no card is open. */
  focusedSpaceChat: FocusedSpaceChat | null;
  setFocusedSpaceChat: (space: FocusedSpaceChat | null) => void;
  // Coherence mode
  mode: 'space' | 'coherence';
  coherenceRoomId: string | null;
  coherenceTitle: string | null;
  coherenceSlug: string | null;
  coherenceDescription: string | null;
  /** Space a direct conversation belongs to, so a call can start the way it does in that space. */
  coherenceSpaceSlug: string | null;
  /** True when this coherence room is the space’s public channel (network connect). */
  coherencePublic: boolean;
  /** Person on the other side of a direct chat (when known). */
  coherencePeerPerson: CoherencePeerPerson | null;
  /** Set when opening a non-DM channel from Messages. */
  coherenceChannel: CoherenceOpenedChannel | null;
  openCoherenceChat: (
    roomId: string | null,
    title: string,
    slug: string,
    description?: string | null,
    spaceSlug?: string | null,
    options?: OpenCoherenceChatOptions,
  ) => void;
  closeCoherenceChat: () => void;
};

const HumanChatPanelContext = createContext<HumanChatPanelContextValue>({
  open: false,
  toggle: () => {},
  openHumanChatPanel: () => {},
  closeHumanChatPanel: () => {},
  unreadMentionCount: 0,
  setUnreadMentionCount: () => {},
  focusedSpaceChat: null,
  setFocusedSpaceChat: () => {},
  mode: 'space',
  coherenceRoomId: null,
  coherenceTitle: null,
  coherenceSlug: null,
  coherenceDescription: null,
  coherenceSpaceSlug: null,
  coherencePublic: false,
  coherencePeerPerson: null,
  coherenceChannel: null,
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
  const [coherenceDescription, setCoherenceDescription] = useState<
    string | null
  >(null);
  const [coherenceSpaceSlug, setCoherenceSpaceSlug] = useState<string | null>(
    null,
  );
  const [coherencePublic, setCoherencePublic] = useState(false);
  const [coherencePeerPerson, setCoherencePeerPerson] =
    useState<CoherencePeerPerson | null>(null);
  const [coherenceChannel, setCoherenceChannel] =
    useState<CoherenceOpenedChannel | null>(null);
  const [unreadMentionCount, setUnreadMentionCountState] = useState(0);
  const [focusedSpaceChat, setFocusedSpaceChatState] =
    useState<FocusedSpaceChat | null>(null);

  const setUnreadMentionCount = useCallback((count: number) => {
    const next = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    setUnreadMentionCountState((prev) => (prev === next ? prev : next));
  }, []);

  const setFocusedSpaceChat = useCallback((next: FocusedSpaceChat | null) => {
    setFocusedSpaceChatState((prev) => {
      if (prev === next) return prev;
      if (
        prev &&
        next &&
        prev.roomId === next.roomId &&
        prev.title === next.title &&
        prev.slug === next.slug &&
        prev.description === next.description
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const openCoherenceChat = useCallback(
    (
      roomId: string | null,
      title: string,
      slug: string,
      description?: string | null,
      spaceSlug?: string | null,
      options?: OpenCoherenceChatOptions,
    ) => {
      setCoherenceRoomId(roomId);
      setCoherenceTitle(title);
      setCoherenceSlug(slug);
      setCoherenceDescription(description?.trim() ? description.trim() : null);
      setCoherenceSpaceSlug(spaceSlug?.trim() ? spaceSlug.trim() : null);
      setCoherencePublic(Boolean(options?.public));
      setCoherenceChannel(options?.channel ?? null);
      const peerSlug = options?.peerPerson?.slug?.trim() ?? '';
      const peerAddress = options?.peerPerson?.address?.trim() || null;
      const peerId =
        options?.peerPerson?.id && options.peerPerson.id > 0
          ? options.peerPerson.id
          : undefined;
      setCoherencePeerPerson(
        peerSlug || peerId || peerAddress
          ? {
              slug: peerSlug,
              address: peerAddress,
              id: peerId,
            }
          : null,
      );
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
    setCoherenceDescription(null);
    setCoherenceSpaceSlug(null);
    setCoherencePublic(false);
    setCoherencePeerPerson(null);
    setCoherenceChannel(null);
  }, []);

  const openHumanChatPanel = useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  const closeHumanChatPanel = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <HumanChatPanelContext.Provider
      value={{
        open,
        toggle,
        openHumanChatPanel,
        closeHumanChatPanel,
        unreadMentionCount,
        setUnreadMentionCount,
        focusedSpaceChat,
        setFocusedSpaceChat,
        mode,
        coherenceRoomId,
        coherenceTitle,
        coherenceSlug,
        coherenceDescription,
        coherenceSpaceSlug,
        coherencePublic,
        coherencePeerPerson,
        coherenceChannel,
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
