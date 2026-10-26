import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { rememberedPersonRoomIsCurrentPeer } from '../member-connections';
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

describe('rememberedPersonRoomIsCurrentPeer', () => {
  it('reuses a remembered room only when the joined peer is the current MXID', () => {
    expect(
      rememberedPersonRoomIsCurrentPeer('@basil-now:matrix', [
        '@basil-now:matrix',
      ]),
    ).toBe(true);
    expect(
      rememberedPersonRoomIsCurrentPeer('@basil-now:matrix', [
        '@basil-old:matrix',
      ]),
    ).toBe(false);
    expect(rememberedPersonRoomIsCurrentPeer(null, ['@basil-old:matrix'])).toBe(
      false,
    );
  });

  it('resolves the current MXID before reusing a person-keyed room', () => {
    const source = readFileSync(
      resolve(__dirname, '../open-person-room.ts'),
      'utf8',
    );
    const mxidAt = source.indexOf(
      'await options.waitForMatrixUserId(options.personId)',
    );
    const reuseAt = source.indexOf('rememberedPersonRoomIsCurrentPeer(');
    expect(mxidAt).toBeGreaterThan(-1);
    expect(reuseAt).toBeGreaterThan(mxidAt);
  });
});
