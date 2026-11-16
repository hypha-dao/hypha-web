// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../common/use-after-idle', () => ({
  useAfterIdle: () => true,
}));

vi.mock('../space-accent-portal-context', () => ({
  useSetSpaceAccentPortalStyles: () => undefined,
}));

import { SpaceAccentFromImages } from '../space-accent-from-images';
import { toCanvasSampleSrc } from '../../../common/optimize-remote-image';

const PONTA_PNG =
  'https://bovzk9ehhu.ufs.sh/f/6MiOwFUJuAcocp3uZG4AN0lxYkareI1GvqLDX2FV5jh8d4fo';

describe('SpaceAccentFromImages Image()', () => {
  const assigned: string[] = [];

  beforeEach(() => {
    assigned.length = 0;
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      width = 64;
      height = 64;
      set src(value: string) {
        assigned.push(value);
      }
      get src() {
        return assigned[assigned.length - 1] ?? '';
      }
    }
    vi.stubGlobal('Image', FakeImage);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('loads the Ponta PNG through /_next/image, never ufs.sh', async () => {
    render(
      <SpaceAccentFromImages bannerSrc="/placeholder.png" logoSrc={PONTA_PNG}>
        <span>child</span>
      </SpaceAccentFromImages>,
    );
    await waitFor(() => {
      expect(assigned.length).toBeGreaterThan(0);
    });
    expect(assigned.every((src) => !src.includes('://bovzk9ehhu.ufs.sh'))).toBe(
      true,
    );
    expect(assigned).toContain(toCanvasSampleSrc(PONTA_PNG));
  });
});
