import { describe, expect, it } from 'vitest';
import { summarizeMatrixTurnHealth } from '../turn-health';

describe('summarizeMatrixTurnHealth', () => {
  it('passes when turn URIs and credentials are present', () => {
    const summary = summarizeMatrixTurnHealth({
      uris: [
        'turn:srv1294735.hstgr.cloud:3478?transport=udp',
        'turn:srv1294735.hstgr.cloud:3478?transport=tcp',
      ],
      username: 'user',
      password: 'pass',
      ttl: 86400,
    });
    expect(summary.turnCredsOk).toBe(true);
    expect(summary.hasTurnUdp).toBe(true);
    expect(summary.hasTurnTcp).toBe(true);
    expect(summary.turnServerUnavailable).toBe(false);
    expect(summary.ttlSec).toBe(86400);
  });

  it('fails when uris are empty', () => {
    const summary = summarizeMatrixTurnHealth({
      uris: [],
      username: 'user',
      password: 'pass',
    });
    expect(summary.turnCredsOk).toBe(false);
    expect(summary.turnServerUnavailable).toBe(true);
  });
});
