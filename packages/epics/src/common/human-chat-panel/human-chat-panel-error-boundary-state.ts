export type ChatPanelErrorBoundaryState = {
  hasError: boolean;
  /** Bumped on Retry so the crashed subtree remounts with a clean hook list. */
  retryNonce: number;
  /** Last throw message — shown in the fallback so a blank “crashed” screen is debuggable. */
  errorMessage: string | null;
};

export function idleChatPanelErrorBoundaryState(): ChatPanelErrorBoundaryState {
  return { hasError: false, retryNonce: 0, errorMessage: null };
}

export function chatPanelErrorBoundaryFromError(
  prev: ChatPanelErrorBoundaryState,
  error?: unknown,
): ChatPanelErrorBoundaryState {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : error != null
      ? String(error)
      : prev.errorMessage;
  return { hasError: true, retryNonce: prev.retryNonce, errorMessage };
}

export function retryChatPanelErrorBoundary(
  prev: ChatPanelErrorBoundaryState,
): ChatPanelErrorBoundaryState {
  return {
    hasError: false,
    retryNonce: prev.retryNonce + 1,
    errorMessage: null,
  };
}

/** Crash fallback must not reuse Matrix reconnect copy. */
export const CHAT_PANEL_CRASH_FALLBACK_MESSAGE_KEY =
  'chatThreadCrashedDescription' as const;
