import { describe, expect, it } from 'vitest';

import {
  noticeKeyForOpenPersonRoomError,
  OpenPersonRoomFailure,
} from '../open-person-room-error';

describe('noticeKeyForOpenPersonRoomError', () => {
  it('maps connection, missing person, and open failures', () => {
    expect(
      noticeKeyForOpenPersonRoomError(
        new OpenPersonRoomFailure('not-connected'),
      ),
    ).toBe('matrixUnavailable');
    expect(
      noticeKeyForOpenPersonRoomError(
        new OpenPersonRoomFailure('no-matrix-id'),
      ),
    ).toBe('matrixPersonUnavailable');
    expect(
      noticeKeyForOpenPersonRoomError(new OpenPersonRoomFailure('open-failed')),
    ).toBe('matrixFailed');
    expect(noticeKeyForOpenPersonRoomError(new Error('boom'))).toBe(
      'matrixFailed',
    );
  });
});
