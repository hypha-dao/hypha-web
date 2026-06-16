import { describe, expect, it } from 'vitest';
import { readInboundRtpVideoFrameSizes } from '../group-call-webrtc-diagnostics';

describe('readInboundRtpVideoFrameSizes', () => {
  it('extracts inbound video frame dimensions from RTCStatsReport', () => {
    const stats = new Map<string, RTCStats>([
      [
        'inbound-video',
        {
          type: 'inbound-rtp',
          kind: 'video',
          frameWidth: 1280,
          frameHeight: 720,
          ssrc: 42,
        } as unknown as RTCStats,
      ],
      [
        'inbound-audio',
        {
          type: 'inbound-rtp',
          kind: 'audio',
          frameWidth: 0,
          frameHeight: 0,
        } as unknown as RTCStats,
      ],
    ]) as unknown as RTCStatsReport;

    expect(readInboundRtpVideoFrameSizes(stats)).toEqual([
      { frameWidth: 1280, frameHeight: 720, ssrc: 42 },
    ]);
  });
});
