import { describe, expect, it, vi } from 'vitest';

import {
  applyOutboundLocalVideoOrientation,
  isUserFacingCallVideoTrack,
  shouldCorrectOutboundUserFacingVideoTrack,
  shouldMirrorCallFeedVideoForDisplay,
} from '../call-local-video-orientation';

describe('call-local-video-orientation', () => {
  it('treats environment camera as not user-facing', () => {
    const track = {
      kind: 'video',
      getSettings: () => ({ facingMode: 'environment' }),
    } as MediaStreamTrack;
    expect(isUserFacingCallVideoTrack(track)).toBe(false);
    expect(
      shouldMirrorCallFeedVideoForDisplay({
        isShare: false,
        isLocalFeed: true,
        videoTrack: track,
      }),
    ).toBe(false);
  });

  it('mirrors local user-facing preview only', () => {
    const track = {
      kind: 'video',
      getSettings: () => ({ facingMode: 'user' }),
    } as MediaStreamTrack;
    expect(
      shouldMirrorCallFeedVideoForDisplay({
        isShare: false,
        isLocalFeed: true,
        videoTrack: track,
      }),
    ).toBe(true);
    expect(
      shouldMirrorCallFeedVideoForDisplay({
        isShare: false,
        isLocalFeed: false,
        videoTrack: track,
      }),
    ).toBe(false);
  });

  it('skips canvas outbound correction on macOS Safari', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    const track = {
      kind: 'video',
      readyState: 'live',
      getSettings: () => ({ facingMode: 'user' }),
    } as MediaStreamTrack;
    expect(shouldCorrectOutboundUserFacingVideoTrack(track)).toBe(false);
    vi.unstubAllGlobals();
  });

  it('skips canvas outbound correction on iPad', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    const track = {
      kind: 'video',
      readyState: 'live',
      getSettings: () => ({ facingMode: 'user' }),
    } as MediaStreamTrack;
    expect(shouldCorrectOutboundUserFacingVideoTrack(track)).toBe(false);
    vi.unstubAllGlobals();
  });

  it('skips outbound correction on desktop Chrome', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    const track = {
      kind: 'video',
      readyState: 'live',
      getSettings: () => ({ facingMode: 'user' }),
    } as MediaStreamTrack;
    expect(shouldCorrectOutboundUserFacingVideoTrack(track)).toBe(false);
    vi.unstubAllGlobals();
  });

  it('skips outbound update on desktop Chrome', async () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    const update = vi.fn().mockResolvedValue(undefined);
    const processed = new Set<string>();
    const track = {
      id: 'cam-1',
      kind: 'video',
      readyState: 'live',
      getSettings: () => ({ facingMode: 'user' }),
    } as MediaStreamTrack;
    const stream = {
      getVideoTracks: () => [track],
      getAudioTracks: () => [],
    } as unknown as MediaStream;

    await applyOutboundLocalVideoOrientation(update, stream, {
      processedSourceTrackIds: processed,
    });

    expect(processed.has('cam-1')).toBe(false);
    expect(update).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
