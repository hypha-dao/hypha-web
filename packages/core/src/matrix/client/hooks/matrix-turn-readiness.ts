'use client';

import type { MatrixClient } from 'matrix-js-sdk';
import { summarizeMatrixIceServers } from './matrix-ice-summary';
import { isMatrixRateLimitedError } from './space-group-call-utils';

export type MatrixTurnReadiness = {
  turnCredsOk: boolean;
  turnTtlSecApprox: number;
  iceEntryCount: number;
  iceUrlCount: number;
  iceHasStun: boolean;
  iceHasTurn: boolean;
  iceHasTurns: boolean;
  iceHostHints: string[];
  /** Homeserver returned no usable TURN relay URIs (and no fallback ICE). */
  turnServerUnavailable: boolean;
};

/**
 * Fetches/refreshes TURN credentials and summarizes ICE servers for WebRTC.
 * Does not log — callers emit telemetry or update UI state.
 */
export const TURN_READINESS_RETRY_MS = 400;
export const TURN_READINESS_CHECK_TIMEOUT_MS = 10_000;
/** Minimum gap between network `checkTurnServers()` calls (Dendrite rate-limits `/voip/turnServer`). */
export const TURN_READINESS_MIN_FETCH_INTERVAL_MS = 30_000;
/** Back off after HTTP 429 / M_LIMIT_EXCEEDED so we do not amplify rate limiting. */
export const TURN_READINESS_RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000;

let turnFetchBackoffUntil = 0;
let lastTurnNetworkFetchAt = 0;
let inFlightReadiness: Promise<MatrixTurnReadiness> | null = null;

/** Test-only reset for module-level throttle state. */
export function resetMatrixTurnReadinessThrottleForTests(): void {
  turnFetchBackoffUntil = 0;
  lastTurnNetworkFetchAt = 0;
  inFlightReadiness = null;
}

async function checkTurnServersWithTimeout(
  client: MatrixClient,
): Promise<boolean> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      client.checkTurnServers(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('checkTurnServers timed out')),
          TURN_READINESS_CHECK_TIMEOUT_MS,
        );
      }),
    ]);
    return result === true;
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId);
  }
}

function readCachedTurnCredsOk(client: MatrixClient, now: number): boolean {
  const expiry = client.getTurnServersExpiry();
  if (!Number.isFinite(expiry) || expiry <= now) return false;
  const raw = client.getTurnServers() as RTCIceServer[];
  return summarizeMatrixIceServers(raw).urlCount > 0;
}

function buildReadinessFromClient(
  client: MatrixClient,
  turnCredsOk: boolean,
  now: number,
): MatrixTurnReadiness {
  const expiry = client.getTurnServersExpiry();
  const turnTtlSecApprox =
    Number.isFinite(expiry) && expiry > 0
      ? Math.max(0, Math.round((expiry - now) / 1000))
      : 0;

  const raw = client.getTurnServers() as RTCIceServer[];
  const iceSummary = summarizeMatrixIceServers(raw);
  const fallbackAllowed = Boolean(
    client.isFallbackICEServerAllowed?.() ?? false,
  );
  const turnServerUnavailable =
    !turnCredsOk ||
    (!iceSummary.hasTurn &&
      !iceSummary.hasTurns &&
      !fallbackAllowed &&
      iceSummary.urlCount === 0);

  return {
    turnCredsOk,
    turnTtlSecApprox,
    iceEntryCount: iceSummary.entryCount,
    iceUrlCount: iceSummary.urlCount,
    iceHasStun: iceSummary.hasStun,
    iceHasTurn: iceSummary.hasTurn,
    iceHasTurns: iceSummary.hasTurns,
    iceHostHints: iceSummary.hostHints,
    turnServerUnavailable,
  };
}

async function evaluateMatrixTurnReadinessInternal(
  client: MatrixClient,
): Promise<MatrixTurnReadiness> {
  const now = Date.now();

  if (now < turnFetchBackoffUntil) {
    return buildReadinessFromClient(
      client,
      readCachedTurnCredsOk(client, now),
      now,
    );
  }

  if (
    now - lastTurnNetworkFetchAt < TURN_READINESS_MIN_FETCH_INTERVAL_MS &&
    readCachedTurnCredsOk(client, now)
  ) {
    return buildReadinessFromClient(client, true, now);
  }

  let turnCredsOk = false;
  let rateLimited = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      lastTurnNetworkFetchAt = Date.now();
      turnCredsOk = await checkTurnServersWithTimeout(client);
      if (turnCredsOk) break;
    } catch (err) {
      turnCredsOk = false;
      if (isMatrixRateLimitedError(err)) {
        rateLimited = true;
        turnFetchBackoffUntil =
          Date.now() + TURN_READINESS_RATE_LIMIT_BACKOFF_MS;
        break;
      }
    }
    if (rateLimited) break;
    if (attempt === 0 && !turnCredsOk) {
      await new Promise((resolve) =>
        setTimeout(resolve, TURN_READINESS_RETRY_MS),
      );
    }
  }

  return buildReadinessFromClient(client, turnCredsOk, now);
}

export async function evaluateMatrixTurnReadiness(
  client: MatrixClient,
): Promise<MatrixTurnReadiness> {
  if (inFlightReadiness) return inFlightReadiness;
  inFlightReadiness = evaluateMatrixTurnReadinessInternal(client).finally(
    () => {
      inFlightReadiness = null;
    },
  );
  return inFlightReadiness;
}
