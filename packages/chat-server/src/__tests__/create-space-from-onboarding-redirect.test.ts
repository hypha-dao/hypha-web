import { describe, expect, it } from 'vitest';

import { shouldBlockDuplicateRootSpaceCreation } from '../tools/create-space-from-onboarding-redirect';

describe('shouldBlockDuplicateRootSpaceCreation', () => {
  it('does not block while execute is waiting on the wallet signature', () => {
    const result = shouldBlockDuplicateRootSpaceCreation({
      onboarding_setup_phase: 'execute',
    });
    expect(result.block).toBe(false);
  });

  it('allows nested on-chain create with parent', () => {
    const result = shouldBlockDuplicateRootSpaceCreation(
      {
        onboarding_setup_phase: 'execute',
        onboarding_created_space_slug: 'my-root',
        parent_space_slug: 'my-root',
      },
      { id: 99 },
      'my-root-community',
    );
    expect(result.block).toBe(false);
  });

  it('does not block during verify when no root slug was saved', () => {
    const result = shouldBlockDuplicateRootSpaceCreation({
      onboarding_setup_phase: 'verify',
    });
    expect(result.block).toBe(false);
  });

  it('blocks another root once the created slug is known', () => {
    const result = shouldBlockDuplicateRootSpaceCreation(
      {
        onboarding_setup_phase: 'execute',
        onboarding_created_space_slug: 'my-root',
      },
      null,
      'another-root',
    );
    expect(result.block).toBe(true);
  });

  it('blocks duplicate slug for an already-created root', () => {
    const result = shouldBlockDuplicateRootSpaceCreation(
      {
        onboarding_setup_phase: 'confirm',
        onboarding_created_space_slug: 'my-root',
      },
      null,
      'my-root',
    );
    expect(result.block).toBe(true);
    if (result.block) {
      expect(result.reason).toContain('my-root');
    }
  });

  it('allows root creation during confirm phase', () => {
    const result = shouldBlockDuplicateRootSpaceCreation({
      onboarding_setup_phase: 'confirm',
    });
    expect(result.block).toBe(false);
  });
});
