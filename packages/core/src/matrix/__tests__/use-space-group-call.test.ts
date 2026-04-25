import { describe, expect, it } from 'vitest';
import { isPermissionLikeGroupCallError } from '../client/hooks/space-group-call-utils';

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
