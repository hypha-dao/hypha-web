import { describe, expect, it } from 'vitest';

import { isMissingPrimaryOrientationColumn } from '../primary-orientation-column';

describe('isMissingPrimaryOrientationColumn', () => {
  it('recognises a missing column wrapped by drizzle', () => {
    const cause = Object.assign(
      new Error(
        'column "primary_orientation" of relation "people" does not exist',
      ),
      { code: '42703' },
    );
    const wrapped = new Error('Failed query: select primary_orientation', {
      cause,
    });
    expect(isMissingPrimaryOrientationColumn(wrapped)).toBe(true);
  });

  it('does not treat other database failures as a missing column', () => {
    expect(
      isMissingPrimaryOrientationColumn(
        new Error('connection string is missing'),
      ),
    ).toBe(false);
  });
});
