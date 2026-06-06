'use client';

import {
  GroupCallStatsReportEvent,
  type GroupCall,
  type MatrixClient,
} from 'matrix-js-sdk';
import { logSpaceGroupCallEvent } from './space-group-call-telemetry';
import { evaluateMatrixTurnReadiness } from './matrix-turn-readiness';
import { summarizeMatrixIceServers } from './matrix-ice-summary';

export { summarizeMatrixIceServers } from './matrix-ice-summary';

/** Fields we log from Matrix SDK summary stats (avoid deep imports Next cannot bundle). */
type GroupCallSummaryStatsReport = {
  percentageReceivedMedia: number;
  percentageReceivedAudioMedia: number;
  percentageReceivedVideoMedia: number;
  maxJitter: number;
  maxPacketLoss: number;
  peerConnections: number;
  opponentUsersInCall?: number;
  opponentDevicesInCall?: number;
  diffDevicesToPeerConnections?: number;
  ratioPeerConnectionToDevices?: number;
};

const TURN_PROBE_LOG_THROTTLE_MS = 60_000;

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

  const readiness = await evaluateMatrixTurnReadiness(client);
  const raw = client.getTurnServers() as RTCIceServer[];
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
    turnCredsOk: readiness.turnCredsOk,
    turnTtlSecApprox: readiness.turnTtlSecApprox,
    iceEntryCount: readiness.iceEntryCount,
    iceUrlCount: readiness.iceUrlCount,
    iceHasStun: readiness.iceHasStun,
    iceHasTurn: readiness.iceHasTurn,
    iceHasTurns: readiness.iceHasTurns,
    iceHostHints: readiness.iceHostHints.length
      ? readiness.iceHostHints
      : undefined,
    forceTurn,
    fallbackIceAllowed: fallbackAllowed,
  });

  if (!readiness.iceHasTurn && !readiness.iceHasTurns && !fallbackAllowed) {
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

type InboundRtpVideoStats = {
  frameWidth?: number;
  frameHeight?: number;
  ssrc?: number;
};

export function readInboundRtpVideoFrameSizes(
  stats: RTCStatsReport,
): InboundRtpVideoStats[] {
  const rows: InboundRtpVideoStats[] = [];
  stats.forEach((report) => {
    if (report.type !== 'inbound-rtp' || report.kind !== 'video') return;
    const frameWidth = report.frameWidth;
    const frameHeight = report.frameHeight;
    if (
      typeof frameWidth !== 'number' ||
      typeof frameHeight !== 'number' ||
      frameWidth <= 0 ||
      frameHeight <= 0
    ) {
      return;
    }
    rows.push({
      frameWidth,
      frameHeight,
      ssrc: typeof report.ssrc === 'number' ? report.ssrc : undefined,
    });
  });
  return rows;
}

async function logInboundRtpFrameSizesForPeerConnection(options: {
  roomId: string;
  groupCallId: string;
  userId: string | null;
  peerConnection: RTCPeerConnection;
  activeSpeakerUserId: string | null;
}): Promise<void> {
  const { roomId, groupCallId, userId, peerConnection, activeSpeakerUserId } =
    options;
  const stats = await peerConnection.getStats();
  const frames = readInboundRtpVideoFrameSizes(stats);
  for (const frame of frames) {
    logSpaceGroupCallEvent({
      name: 'hypha.group_call.inbound_rtp_frame_size',
      roomId,
      groupCallId,
      remoteUserId: userId ?? undefined,
      activeSpeaker:
        userId != null &&
        activeSpeakerUserId != null &&
        userId === activeSpeakerUserId,
      frameWidth: frame.frameWidth,
      frameHeight: frame.frameHeight,
      ssrc: frame.ssrc,
    });
  }
}

/**
 * Enables Matrix SDK summary stats on the group call and forwards a privacy-safe subset to console telemetry.
 */
export function attachGroupCallWebRtcDiagnostics(options: {
  gc: GroupCall;
  roomId: string;
  summaryStatsIntervalMs: number;
  inboundRtpFrameLogIntervalMs?: number;
  resolveActiveSpeakerUserId?: () => string | null;
  enumeratePeerConnections?: (
    gc: GroupCall,
  ) => Array<{ userId: string | null; peerConnection: RTCPeerConnection }>;
}): GroupCallDiagnosticsCleanup {
  const {
    gc,
    roomId,
    summaryStatsIntervalMs,
    inboundRtpFrameLogIntervalMs = 0,
    resolveActiveSpeakerUserId,
    enumeratePeerConnections,
  } = options;

  if (summaryStatsIntervalMs > 0) {
    gc.setGroupCallStatsInterval(summaryStatsIntervalMs);
  }

  const onSummary = (payload: { report: GroupCallSummaryStatsReport }) => {
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

  let frameLogInterval: ReturnType<typeof setInterval> | null = null;
  const logFrameSizes = () => {
    if (!enumeratePeerConnections) return;
    const activeSpeakerUserId = resolveActiveSpeakerUserId?.() ?? null;
    for (const { userId, peerConnection } of enumeratePeerConnections(gc)) {
      void logInboundRtpFrameSizesForPeerConnection({
        roomId,
        groupCallId: gc.groupCallId,
        userId,
        peerConnection,
        activeSpeakerUserId,
      });
    }
  };

  if (inboundRtpFrameLogIntervalMs > 0 && enumeratePeerConnections) {
    logFrameSizes();
    frameLogInterval = setInterval(logFrameSizes, inboundRtpFrameLogIntervalMs);
  }

  return () => {
    gc.removeListener(GroupCallStatsReportEvent.SummaryStats, onSummary);
    if (summaryStatsIntervalMs > 0) {
      gc.setGroupCallStatsInterval(0);
    }
    if (frameLogInterval != null) {
      clearInterval(frameLogInterval);
      frameLogInterval = null;
    }
  };
}
