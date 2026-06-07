import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  TURN_READINESS_CHECK_TIMEOUT_MS,
  TURN_READINESS_RETRY_MS,
  evaluateMatrixTurnReadiness,
} from '../matrix-turn-readiness';

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
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks TURN available when creds and relay URIs exist on first attempt', async () => {
    const readinessPromise = evaluateMatrixTurnReadiness(mockClient());
    await vi.runAllTimersAsync();
    const readiness = await readinessPromise;
    expect(readiness.turnCredsOk).toBe(true);
    expect(readiness.iceHasTurn).toBe(true);
    expect(readiness.turnServerUnavailable).toBe(false);
  });

  it('retries after first checkTurnServers returns false then succeeds', async () => {
    const checkTurnServers = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const readinessPromise = evaluateMatrixTurnReadiness(
      mockClient({ checkTurnServers }),
    );
    await vi.advanceTimersByTimeAsync(TURN_READINESS_RETRY_MS);
    const readiness = await readinessPromise;
    expect(checkTurnServers).toHaveBeenCalledTimes(2);
    expect(readiness.turnCredsOk).toBe(true);
    expect(readiness.turnServerUnavailable).toBe(false);
  });

  it('marks TURN unavailable when both attempts return false', async () => {
    const checkTurnServers = vi.fn(async () => false);
    const readinessPromise = evaluateMatrixTurnReadiness(
      mockClient({
        checkTurnServers,
        getTurnServers: vi.fn(() => []),
      }),
    );
    await vi.advanceTimersByTimeAsync(TURN_READINESS_RETRY_MS);
    const readiness = await readinessPromise;
    expect(checkTurnServers).toHaveBeenCalledTimes(2);
    expect(readiness.turnCredsOk).toBe(false);
    expect(readiness.turnServerUnavailable).toBe(true);
  });

  it('retries after first checkTurnServers throws then succeeds', async () => {
    const checkTurnServers = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(true);
    const readinessPromise = evaluateMatrixTurnReadiness(
      mockClient({ checkTurnServers }),
    );
    await vi.advanceTimersByTimeAsync(TURN_READINESS_RETRY_MS);
    const readiness = await readinessPromise;
    expect(checkTurnServers).toHaveBeenCalledTimes(2);
    expect(readiness.turnCredsOk).toBe(true);
    expect(readiness.turnServerUnavailable).toBe(false);
  });

  it('marks TURN unavailable when both attempts throw', async () => {
    const checkTurnServers = vi.fn(async () => {
      throw new Error('network');
    });
    const readinessPromise = evaluateMatrixTurnReadiness(
      mockClient({
        checkTurnServers,
        getTurnServers: vi.fn(() => []),
      }),
    );
    await vi.advanceTimersByTimeAsync(TURN_READINESS_RETRY_MS);
    const readiness = await readinessPromise;
    expect(checkTurnServers).toHaveBeenCalledTimes(2);
    expect(readiness.turnCredsOk).toBe(false);
    expect(readiness.turnServerUnavailable).toBe(true);
  });

  it('retries when checkTurnServers hangs past the per-call timeout', async () => {
    const checkTurnServers = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<boolean>(() => {
            /* never resolves */
          }),
      )
      .mockResolvedValueOnce(true);
    const readinessPromise = evaluateMatrixTurnReadiness(
      mockClient({ checkTurnServers }),
    );
    await vi.advanceTimersByTimeAsync(TURN_READINESS_CHECK_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(TURN_READINESS_RETRY_MS);
    const readiness = await readinessPromise;
    expect(checkTurnServers).toHaveBeenCalledTimes(2);
    expect(readiness.turnCredsOk).toBe(true);
  });
});
