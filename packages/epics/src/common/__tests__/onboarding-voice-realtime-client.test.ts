import { describe, expect, it } from 'vitest';

import {
  extractRealtimeErrorInfo,
  isIgnorableRealtimeError,
} from '../onboarding-voice-realtime-client';

describe('realtime error helpers', () => {
  it('extracts error info from server error events', () => {
    expect(
      extractRealtimeErrorInfo({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          code: 'response_cancel_not_active',
          message: 'Cancellation failed: no active response found',
        },
      }),
    ).toEqual({
      code: 'response_cancel_not_active',
      message: 'Cancellation failed: no active response found',
    });
  });

  it('treats response cancel races as ignorable', () => {
    expect(
      isIgnorableRealtimeError({
        code: 'response_cancel_not_active',
        message: 'Cancellation failed: no active response found',
      }),
    ).toBe(true);
  });

  it('does not ignore unknown realtime errors', () => {
    expect(
      isIgnorableRealtimeError({
        code: 'invalid_value',
        message: 'Invalid session.update payload',
      }),
    ).toBe(false);
  });
});
