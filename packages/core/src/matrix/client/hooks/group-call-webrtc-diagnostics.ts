'use client';

import type { MatrixClient } from 'matrix-js-sdk';
import {
  GroupCallStatsReportEvent,
  type GroupCall,
} from 'matrix-js-sdk/lib/webrtc/groupCall';
import type { SummaryStatsReport } from 'matrix-js-sdk/lib/webrtc/stats/statsReport';
import { logSpaceGroupCallEvent } from './space-group-call-telemetry';

const TURN_PROBE_LOG_THROTTLE_MS = 60_000;

type IceUrlKind = 'stun' | 'turn' | 'turns' | 'unknown';

function iceUrlKind(url: string): IceUrlKind {
  const u = url.trim().toLowerCase();
  if (u.startsWith('stun:') || u.startsWith('stuns:')) return 'stun';
  if (u.startsWith('turns:')) return 'turns';
  if (u.startsWith('turn:')) return 'turn';
  return 'unknown';
}

/** One object per RTCPeerConnection `iceServers` entry — no secrets. */
export function summarizeMatrixIceServers(raw: RTCIceServer[] | undefined): {
  /** Count of `iceServers` objects. */
  entryCount: number;
  /** Total URL strings across all entries. */
  urlCount: number;
  hasStun: boolean;
  hasTurn: boolean;
  hasTurns: boolean;
  /** Sample of hostname-like segments (first label of host), not full URLs. */
  hostHints: string[];
} {
  if (!raw?.length) {
    return {
      entryCount: 0,
      urlCount: 0,
      hasStun: false,
      hasTurn: false,
      hasTurns: false,
      hostHints: [],
    };
  }
  let urlCount = 0;
  let hasStun = false;
  let hasTurn = false;
  let hasTurns = false;
  const hostHints: string[] = [];

  for (const e of raw) {
    const urls = Array.isArray(e.urls) ? e.urls : e.urls ? [e.urls] : [];
    urlCount += urls.length;
    for (const url of urls) {
      const k = iceUrlKind(String(url));
      if (k === 'stun') hasStun = true;
      if (k === 'turn') hasTurn = true;
      if (k === 'turns') hasTurns = true;
      try {
        const u = new URL(
          String(url)
            .replace(/^stun[s]?:/i, 'https:')
            .replace(/^turn[s]?:/i, 'https:'),
        );
        const h = u.hostname.split('.')[0];
        if (h && !hostHints.includes(h) && hostHints.length < 6) {
          hostHints.push(h);
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return {
    entryCount: raw.length,
    urlCount,
    hasStun,
    hasTurn,
    hasTurns,
    hostHints,
  };
}

let lastTurnProbeAt = 0;

/**
 * Logs one privacy-safe row about TURN reachability after `checkTurnServers()`.
 * Uses a short-lived `RTCPeerConnection` gather test — does not replace full call media.
 */
export async function probeMatrixTurnServerReadiness(options: {
  client: MatrixClient;
  roomId: string;
  kind?: 'audio' | 'video';
}): Promise<void> {
  if (typeof RTCPeerConnection === 'undefined') return;
  const { client, roomId, kind } = options;
  const now = Date.now();
  if (now - lastTurnProbeAt < TURN_PROBE_LOG_THROTTLE_MS) return;
  lastTurnProbeAt = now;

  let turnCredsOk = false;
  try {
    const r = await client.checkTurnServers();
    turnCredsOk = r === true;
  } catch {
    turnCredsOk = false;
  }

  const expiry = client.getTurnServersExpiry();
  const ttlSecApprox =
    Number.isFinite(expiry) && expiry > 0
      ? Math.max(0, Math.round((expiry - now) / 1000))
      : 0;

  const raw = client.getTurnServers() as RTCIceServer[];
  const iceSummary = summarizeMatrixIceServers(raw);
  const forceTurn = Boolean(
    (client as { forceTURN?: boolean }).forceTURN ?? false,
  );
  const fallbackAllowed = Boolean(
    client.isFallbackICEServerAllowed?.() ?? false,
  );

  logSpaceGroupCallEvent({
    name: 'hypha.group_call.turn_probe',
    roomId,
    kind,
    turnCredsOk,
    turnTtlSecApprox: ttlSecApprox,
    iceEntryCount: iceSummary.entryCount,
    iceUrlCount: iceSummary.urlCount,
    iceHasStun: iceSummary.hasStun,
    iceHasTurn: iceSummary.hasTurn,
    iceHasTurns: iceSummary.hasTurns,
    iceHostHints: iceSummary.hostHints.length
      ? iceSummary.hostHints
      : undefined,
    forceTurn,
    fallbackIceAllowed: fallbackAllowed,
  });

  if (!iceSummary.hasTurn && !iceSummary.hasTurns && !fallbackAllowed) {
    /** Quick gather sanity check — confirms browser can reach at least STUN if configured. */
    let gatherState: RTCIceGatheringState | 'unsupported' | 'timeout' =
      'unsupported';
    try {
      const pc = new RTCPeerConnection({
        iceServers: raw.length ? raw : [],
      });
      gatherState = pc.iceGatheringState;
      await new Promise<void>((resolve) => {
        const schedule = globalThis.setTimeout.bind(globalThis);
        const cancel = globalThis.clearTimeout.bind(globalThis);
        const t = schedule(() => {
          cleanup();
          gatherState = 'timeout';
          resolve();
        }, 4500);
        const cleanup = () => {
          cancel(t);
          pc.onicegatheringstatechange = null;
          try {
            pc.close();
          } catch {
            /* ignore */
          }
        };
        pc.onicegatheringstatechange = () => {
          gatherState = pc.iceGatheringState;
          if (pc.iceGatheringState === 'complete') {
            cleanup();
            resolve();
          }
        };
        try {
          pc.createDataChannel('probe', { ordered: false });
        } catch {
          /* ignore */
        }
        void pc.createOffer().then((o) => pc.setLocalDescription(o));
      });
    } catch {
      gatherState = 'unsupported';
    }

    logSpaceGroupCallEvent({
      name: 'hypha.group_call.ice_gather_probe',
      roomId,
      kind,
      iceGatherState: gatherState,
    });
  }
}

export type GroupCallDiagnosticsCleanup = () => void;

/**
 * Enables Matrix SDK summary stats on the group call and forwards a privacy-safe subset to console telemetry.
 */
export function attachGroupCallWebRtcDiagnostics(options: {
  gc: GroupCall;
  roomId: string;
  summaryStatsIntervalMs: number;
}): GroupCallDiagnosticsCleanup {
  const { gc, roomId, summaryStatsIntervalMs } = options;

  if (summaryStatsIntervalMs > 0) {
    gc.setGroupCallStatsInterval(summaryStatsIntervalMs);
  }

  const onSummary = (payload: { report: SummaryStatsReport }) => {
    const r = payload.report;
    logSpaceGroupCallEvent({
      name: 'hypha.group_call.webrtc_summary',
      roomId,
      groupCallId: gc.groupCallId,
      percentageReceivedMedia: r.percentageReceivedMedia,
      percentageReceivedAudioMedia: r.percentageReceivedAudioMedia,
      percentageReceivedVideoMedia: r.percentageReceivedVideoMedia,
      maxJitter: r.maxJitter,
      maxPacketLoss: r.maxPacketLoss,
      peerConnections: r.peerConnections,
      opponentUsersInCall: r.opponentUsersInCall,
      opponentDevicesInCall: r.opponentDevicesInCall,
      diffDevicesToPeerConnections: r.diffDevicesToPeerConnections,
      ratioPeerConnectionToDevices: r.ratioPeerConnectionToDevices,
    });
  };

  gc.on(GroupCallStatsReportEvent.SummaryStats, onSummary);

  return () => {
    gc.removeListener(GroupCallStatsReportEvent.SummaryStats, onSummary);
    if (summaryStatsIntervalMs > 0) {
      gc.setGroupCallStatsInterval(0);
    }
  };
}
