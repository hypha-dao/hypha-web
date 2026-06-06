import { describe, expect, it, vi } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';
import { evaluateMatrixTurnReadiness } from '../matrix-turn-readiness';

function mockClient(overrides: Partial<MatrixClient> = {}): MatrixClient {
  return {
    checkTurnServers: vi.fn(async () => true),
    getTurnServersExpiry: vi.fn(() => Date.now() + 3_600_000),
    getTurnServers: vi.fn(() => [
      {
        urls: ['turn:turn.example.org:3478?transport=udp'],
        username: 'u',
        credential: 'p',
      },
    ]),
    isFallbackICEServerAllowed: vi.fn(() => false),
    ...overrides,
  } as unknown as MatrixClient;
}

describe('evaluateMatrixTurnReadiness', () => {
  it('marks TURN available when creds and relay URIs exist', async () => {
    const readiness = await evaluateMatrixTurnReadiness(mockClient());
    expect(readiness.turnCredsOk).toBe(true);
    expect(readiness.iceHasTurn).toBe(true);
    expect(readiness.turnServerUnavailable).toBe(false);
  });

  it('marks TURN unavailable when checkTurnServers fails', async () => {
    const readiness = await evaluateMatrixTurnReadiness(
      mockClient({
        checkTurnServers: vi.fn(async () => false),
        getTurnServers: vi.fn(() => []),
      }),
    );
    expect(readiness.turnCredsOk).toBe(false);
    expect(readiness.turnServerUnavailable).toBe(true);
  });
});
