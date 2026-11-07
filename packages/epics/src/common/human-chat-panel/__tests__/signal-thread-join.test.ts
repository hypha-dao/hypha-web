import { describe, expect, it } from 'vitest';

import { isSignalThreadJoin } from '../signal-thread-join';

describe('isSignalThreadJoin', () => {
  it('treats a signal opened with its space slug as a signal thread', () => {
    expect(
      isSignalThreadJoin({
        coherenceSlug: 'fix-the-roof',
        spaceSlug: 'hypha',
        isPublic: false,
      }),
    ).toBe(true);
  });

  it('treats a signal opened without a space slug as a signal thread', () => {
    expect(
      isSignalThreadJoin({
        coherenceSlug: 'fix-the-roof',
        spaceSlug: null,
        isPublic: false,
      }),
    ).toBe(true);
  });

  it('leaves space channels on the space room path', () => {
    expect(
      isSignalThreadJoin({
        coherenceSlug: '',
        spaceSlug: 'hypha',
        isPublic: false,
      }),
    ).toBe(false);
    expect(
      isSignalThreadJoin({
        coherenceSlug: 'hypha',
        spaceSlug: 'hypha',
        isPublic: false,
      }),
    ).toBe(false);
  });

  it('never treats a public channel as a signal thread', () => {
    expect(
      isSignalThreadJoin({
        coherenceSlug: 'fix-the-roof',
        spaceSlug: 'hypha',
        isPublic: true,
      }),
    ).toBe(false);
  });
});
