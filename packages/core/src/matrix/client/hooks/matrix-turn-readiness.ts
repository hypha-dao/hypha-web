'use client';

import type { MatrixClient } from 'matrix-js-sdk';
import { summarizeMatrixIceServers } from './matrix-ice-summary';

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
export async function evaluateMatrixTurnReadiness(
  client: MatrixClient,
): Promise<MatrixTurnReadiness> {
  const now = Date.now();
  let turnCredsOk = false;
  try {
    turnCredsOk = (await client.checkTurnServers()) === true;
  } catch {
    turnCredsOk = false;
  }

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
