export type ChatPanelErrorBoundaryState = {
  hasError: boolean;
  /** Bumped on Retry so the crashed subtree remounts with a clean hook list. */
  retryNonce: number;
};

export function idleChatPanelErrorBoundaryState(): ChatPanelErrorBoundaryState {
  return { hasError: false, retryNonce: 0 };
}

export function chatPanelErrorBoundaryFromError(
  prev: ChatPanelErrorBoundaryState,
): ChatPanelErrorBoundaryState {
  return { hasError: true, retryNonce: prev.retryNonce };
}

export function retryChatPanelErrorBoundary(
  prev: ChatPanelErrorBoundaryState,
): ChatPanelErrorBoundaryState {
  return { hasError: false, retryNonce: prev.retryNonce + 1 };
}

/** Crash fallback must not reuse Matrix reconnect copy. */
export const CHAT_PANEL_CRASH_FALLBACK_MESSAGE_KEY =
  'chatThreadCrashedDescription' as const;
