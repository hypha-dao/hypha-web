import { describe, expect, it, vi } from 'vitest';
import {
  CALL_THUMBNAIL_DOWNSCALE_FACTOR,
  CALL_THUMBNAIL_DOWNSCALE_MIN_PARTICIPANTS,
  applyCallThumbnailReceiverDownscale,
  enumerateGroupCallPeerConnections,
  parseActiveSpeakerUserId,
} from '../call-thumbnail-receiver-downscale';

describe('parseActiveSpeakerUserId', () => {
  it('extracts user id from active speaker key', () => {
    expect(parseActiveSpeakerUserId('@alice:matrix.org::DEVICE')).toBe(
      '@alice:matrix.org',
    );
    expect(parseActiveSpeakerUserId('@bob:matrix.org')).toBe('@bob:matrix.org');
    expect(parseActiveSpeakerUserId(null)).toBeNull();
  });
});

describe('enumerateGroupCallPeerConnections', () => {
  it('walks group call pairwise connections via forEachCall', () => {
    const peerConnection = {} as RTCPeerConnection;
    const gc = {
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          peerConn: peerConnection,
          getOpponentMember: () => ({ userId: '@remote:matrix.org' }),
        });
      },
    };

    expect(enumerateGroupCallPeerConnections(gc)).toEqual([
      { userId: '@remote:matrix.org', peerConnection },
    ]);
  });
});

describe('applyCallThumbnailReceiverDownscale', () => {
  it('downscales non-active-speaker receivers when N ≥ threshold', async () => {
    const setParameters = vi.fn().mockResolvedValue(undefined);
    const activeReceiver = {
      track: { kind: 'video' },
      getParameters: () => ({ encodings: [{ scaleResolutionDownBy: 1 }] }),
      setParameters,
    } as unknown as RTCRtpReceiver;
    const thumbnailReceiver = {
      track: { kind: 'video' },
      getParameters: () => ({ encodings: [{ scaleResolutionDownBy: 1 }] }),
      setParameters,
    } as unknown as RTCRtpReceiver;
    const activePeerConnection = {
      getReceivers: () => [activeReceiver],
    } as unknown as RTCPeerConnection;
    const thumbnailPeerConnection = {
      getReceivers: () => [thumbnailReceiver],
    } as unknown as RTCPeerConnection;

    const gc = {
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          peerConn: activePeerConnection,
          getOpponentMember: () => ({ userId: '@active:matrix.org' }),
        });
        callback({
          peerConn: thumbnailPeerConnection,
          getOpponentMember: () => ({ userId: '@thumb:matrix.org' }),
        });
      },
    };

    const result = await applyCallThumbnailReceiverDownscale({
      gc,
      participantCount: CALL_THUMBNAIL_DOWNSCALE_MIN_PARTICIPANTS,
      activeSpeakerUserId: '@active:matrix.org',
      enabled: true,
    });

    expect(result.adjustedReceivers).toBe(2);
    expect(setParameters).toHaveBeenCalledWith({
      encodings: [{ scaleResolutionDownBy: 1 }],
    });
    expect(setParameters).toHaveBeenCalledWith({
      encodings: [{ scaleResolutionDownBy: CALL_THUMBNAIL_DOWNSCALE_FACTOR }],
    });
  });

  it('resets downscale when participant count drops below threshold', async () => {
    const setParameters = vi.fn().mockResolvedValue(undefined);
    const receiver = {
      track: { kind: 'video' },
      getParameters: () => ({
        encodings: [{ scaleResolutionDownBy: CALL_THUMBNAIL_DOWNSCALE_FACTOR }],
      }),
      setParameters,
    } as unknown as RTCRtpReceiver;
    const gc = {
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          peerConn: {
            getReceivers: () => [receiver],
          },
          getOpponentMember: () => ({ userId: '@remote:matrix.org' }),
        });
      },
    };

    await applyCallThumbnailReceiverDownscale({
      gc,
      participantCount: CALL_THUMBNAIL_DOWNSCALE_MIN_PARTICIPANTS - 1,
      activeSpeakerUserId: null,
      enabled: true,
    });

    expect(setParameters).toHaveBeenCalledWith({
      encodings: [{ scaleResolutionDownBy: 1 }],
    });
  });
});
