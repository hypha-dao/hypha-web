// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import {
  HYPHA_SCREEN_SHARE_CAPTURE_ROOT_ID,
  HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID,
  applyScreenShareCaptureRootRestriction,
  clearScreenShareCaptureRootRestriction,
} from '../screenshare-capture-exclusion';

describe('screenshare capture exclusion', () => {
  it('restricts tab capture to the app shell root when supported', async () => {
    const root = document.createElement('div');
    root.id = HYPHA_SCREEN_SHARE_CAPTURE_ROOT_ID;
    document.body.appendChild(root);

    const restrictTo = vi.fn().mockResolvedValue(undefined);
    const target = {};
    const fromElement = vi.fn().mockResolvedValue(target);
    (
      globalThis as typeof globalThis & {
        RestrictionTarget: {
          fromElement: (element: Element) => Promise<object>;
        };
      }
    ).RestrictionTarget = { fromElement };

    const track = {
      readyState: 'live',
      getSettings: () => ({ displaySurface: 'browser' }),
      restrictTo,
    } as unknown as MediaStreamTrack;

    const stream = {
      getVideoTracks: () => [track],
    } as MediaStream;

    const ok = await applyScreenShareCaptureRootRestriction(stream);
    expect(ok).toBe(true);
    expect(fromElement).toHaveBeenCalledWith(root);
    expect(restrictTo).toHaveBeenCalledWith(target);

    await clearScreenShareCaptureRootRestriction(stream);
    expect(restrictTo).toHaveBeenCalledWith(null);

    root.remove();
    delete (
      globalThis as typeof globalThis & {
        RestrictionTarget?: unknown;
      }
    ).RestrictionTarget;
  });

  it('prefers the main content column over the legacy shell root', async () => {
    const shell = document.createElement('div');
    shell.id = HYPHA_SCREEN_SHARE_CAPTURE_ROOT_ID;
    const main = document.createElement('div');
    main.id = HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID;
    shell.appendChild(main);
    document.body.appendChild(shell);

    const restrictTo = vi.fn().mockResolvedValue(undefined);
    const target = {};
    const fromElement = vi.fn().mockResolvedValue(target);
    (
      globalThis as typeof globalThis & {
        RestrictionTarget: {
          fromElement: (element: Element) => Promise<object>;
        };
      }
    ).RestrictionTarget = { fromElement };

    const track = {
      readyState: 'live',
      getSettings: () => ({ displaySurface: 'browser' }),
      restrictTo,
    } as unknown as MediaStreamTrack;

    const ok = await applyScreenShareCaptureRootRestriction({
      getVideoTracks: () => [track],
    } as MediaStream);

    expect(ok).toBe(true);
    expect(fromElement).toHaveBeenCalledWith(main);

    shell.remove();
    delete (
      globalThis as typeof globalThis & {
        RestrictionTarget?: unknown;
      }
    ).RestrictionTarget;
  });

  it('skips restriction for monitor/window capture', async () => {
    const root = document.createElement('div');
    root.id = HYPHA_SCREEN_SHARE_CAPTURE_ROOT_ID;
    document.body.appendChild(root);

    const restrictTo = vi.fn();
    (
      globalThis as typeof globalThis & {
        RestrictionTarget: {
          fromElement: (element: Element) => Promise<object>;
        };
      }
    ).RestrictionTarget = {
      fromElement: vi.fn(),
    };

    const track = {
      readyState: 'live',
      getSettings: () => ({ displaySurface: 'monitor' }),
      restrictTo,
    } as unknown as MediaStreamTrack;

    const ok = await applyScreenShareCaptureRootRestriction({
      getVideoTracks: () => [track],
    } as MediaStream);

    expect(ok).toBe(false);
    expect(restrictTo).not.toHaveBeenCalled();

    root.remove();
    delete (
      globalThis as typeof globalThis & {
        RestrictionTarget?: unknown;
      }
    ).RestrictionTarget;
  });
});
