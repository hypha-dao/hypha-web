import { describe, expect, it } from 'vitest';
import { summarizeMatrixIceServers } from '../matrix-ice-summary';

describe('summarizeMatrixIceServers', () => {
  it('returns empty summary for missing servers', () => {
    expect(summarizeMatrixIceServers(undefined)).toEqual({
      entryCount: 0,
      urlCount: 0,
      hasStun: false,
      hasTurn: false,
      hasTurns: false,
      hostHints: [],
    });
  });

  it('detects turn and stun URLs without leaking full hostnames', () => {
    const summary = summarizeMatrixIceServers([
      {
        urls: [
          'stun:srv1294735.hstgr.cloud:3478',
          'turn:srv1294735.hstgr.cloud:3478?transport=udp',
          'turn:srv1294735.hstgr.cloud:3478?transport=tcp',
        ],
        username: 'u',
        credential: 'p',
      },
    ]);
    expect(summary.entryCount).toBe(1);
    expect(summary.urlCount).toBe(3);
    expect(summary.hasStun).toBe(true);
    expect(summary.hasTurn).toBe(true);
    expect(summary.hasTurns).toBe(false);
    expect(summary.hostHints).toContain('srv1294735');
  });
});
