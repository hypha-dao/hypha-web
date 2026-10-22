import { describe, expect, it } from 'vitest';

import {
  extractRealtimeErrorInfo,
  isIgnorableRealtimeError,
  isSubstantiveUserTranscript,
  microphoneCaptureErrorCode,
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

describe('microphoneCaptureErrorCode', () => {
  it('recognises a blocked microphone', () => {
    expect(
      microphoneCaptureErrorCode(
        new DOMException('Permission denied', 'NotAllowedError'),
      ),
    ).toBe('not-allowed');
  });

  it('recognises a missing microphone', () => {
    expect(
      microphoneCaptureErrorCode(
        new DOMException('Requested device not found', 'NotFoundError'),
      ),
    ).toBe('audio-capture');
  });

  it('leaves session failures for the voice retry path', () => {
    expect(microphoneCaptureErrorCode(new Error('Could not start'))).toBe(null);
  });
});

describe('isSubstantiveUserTranscript', () => {
  it('accepts normal user phrases', () => {
    expect(isSubstantiveUserTranscript('Bonjour.')).toBe(true);
    expect(
      isSubstantiveUserTranscript("OK, comment est-ce que tu peux m'aider ?"),
    ).toBe(true);
    expect(isSubstantiveUserTranscript('Tu peux reprendre.')).toBe(true);
  });

  it('rejects noise and filler transcripts', () => {
    expect(isSubstantiveUserTranscript('')).toBe(false);
    expect(isSubstantiveUserTranscript('uh')).toBe(false);
    expect(isSubstantiveUserTranscript('hmm')).toBe(false);
    expect(isSubstantiveUserTranscript('...')).toBe(false);
  });
});
