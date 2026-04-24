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

  it('returns false for generic error', () => {
    expect(isPermissionLikeGroupCallError(new Error('ICE failed'))).toBe(false);
  });
});
