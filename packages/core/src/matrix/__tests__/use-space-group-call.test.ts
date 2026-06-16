import { describe, expect, it } from 'vitest';
import {
  isMatrixRateLimitedError,
  isPermissionLikeGroupCallError,
  resolveGroupCallErrorDuringScreenshare,
  shouldIgnoreGroupCallErrorDuringCapture,
} from '../client/hooks/space-group-call-utils';

describe('isPermissionLikeGroupCallError', () => {
  it('returns true for no_user_media code', () => {
    expect(isPermissionLikeGroupCallError({ code: 'no_user_media' })).toBe(
      true,
    );
  });

  it('returns true for NotAllowedError message', () => {
    expect(
      isPermissionLikeGroupCallError(
        new Error('NotAllowedError: Permission denied'),
      ),
    ).toBe(true);
  });

  it('returns true when DOMException name is NotAllowedError', () => {
    const e = new DOMException('The request is not allowed', 'NotAllowedError');
    expect(isPermissionLikeGroupCallError(e)).toBe(true);
  });

  it('returns true for PermissionDismissedError name (experimental)', () => {
    expect(
      isPermissionLikeGroupCallError(
        new DOMException('dismissed', 'PermissionDismissedError'),
      ),
    ).toBe(true);
  });

  it('returns true for NotReadableError name (device busy)', () => {
    expect(
      isPermissionLikeGroupCallError(
        new DOMException('Could not start video', 'NotReadableError'),
      ),
    ).toBe(true);
  });

  it('returns true for OverconstrainedError name', () => {
    expect(
      isPermissionLikeGroupCallError(
        new DOMException('constraint', 'OverconstrainedError'),
      ),
    ).toBe(true);
  });

  it('returns false for generic error', () => {
    expect(isPermissionLikeGroupCallError(new Error('ICE failed'))).toBe(false);
  });
});

describe('isMatrixRateLimitedError', () => {
  it('returns true for M_LIMIT_EXCEEDED errcode', () => {
    const err = new Error(
      'MatrixError: [429] You are sending too many requests',
    );
    (err as Error & { errcode?: string }).errcode = 'M_LIMIT_EXCEEDED';
    expect(isMatrixRateLimitedError(err)).toBe(true);
  });

  it('returns false for generic WebRTC error', () => {
    expect(isMatrixRateLimitedError(new Error('ICE failed'))).toBe(false);
  });
});

describe('shouldIgnoreGroupCallErrorDuringCapture', () => {
  it('never ignores permission errors', () => {
    const err = new DOMException('denied', 'NotAllowedError');
    expect(shouldIgnoreGroupCallErrorDuringCapture(err, true)).toBe(false);
  });

  it('ignores rate limit errors even without capture', () => {
    const err = new Error('[429] too many requests');
    expect(shouldIgnoreGroupCallErrorDuringCapture(err, false)).toBe(true);
  });

  it('ignores non-permission errors while capture is active', () => {
    expect(
      shouldIgnoreGroupCallErrorDuringCapture(new Error('ICE failed'), true),
    ).toBe(true);
  });

  it('does not ignore non-permission errors when capture is idle', () => {
    expect(
      shouldIgnoreGroupCallErrorDuringCapture(new Error('ICE failed'), false),
    ).toBe(false);
  });
});

describe('resolveGroupCallErrorDuringScreenshare', () => {
  it('scopes permission errors to screenshare only', () => {
    const err = new DOMException('denied', 'NotAllowedError');
    expect(resolveGroupCallErrorDuringScreenshare(err)).toBe(
      'screenshare_only',
    );
  });

  it('ignores transient errors during screenshare', () => {
    const err = new Error('[429] too many requests');
    expect(resolveGroupCallErrorDuringScreenshare(err)).toBe('ignore');
  });

  it('scopes WebRTC failures to screenshare only', () => {
    expect(
      resolveGroupCallErrorDuringScreenshare(new Error('ICE failed')),
    ).toBe('screenshare_only');
  });
});
