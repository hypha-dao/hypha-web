import { describe, expect, it } from 'vitest';

import {
  CHAT_PANEL_CRASH_FALLBACK_MESSAGE_KEY,
  chatPanelErrorBoundaryFromError,
  idleChatPanelErrorBoundaryState,
  retryChatPanelErrorBoundary,
} from '../human-chat-panel-error-boundary-state';

describe('chat panel error boundary state', () => {
  it('does not reuse Matrix reconnect copy for a render crash', () => {
    expect(CHAT_PANEL_CRASH_FALLBACK_MESSAGE_KEY).toBe(
      'chatThreadCrashedDescription',
    );
    expect(CHAT_PANEL_CRASH_FALLBACK_MESSAGE_KEY).not.toBe(
      'connectionRetryFailedDescription',
    );
  });

  it('keeps the retry nonce when capturing an error', () => {
    const prev = { hasError: false, retryNonce: 3 };
    expect(chatPanelErrorBoundaryFromError(prev)).toEqual({
      hasError: true,
      retryNonce: 3,
    });
  });

  it('increments the retry nonce so Retry remounts a clean hook tree', () => {
    const afterCrash = chatPanelErrorBoundaryFromError(
      idleChatPanelErrorBoundaryState(),
    );
    expect(retryChatPanelErrorBoundary(afterCrash)).toEqual({
      hasError: false,
      retryNonce: 1,
    });
  });
});
