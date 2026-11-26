'use client';

import { useSyncExternalStore } from 'react';
import {
  Track,
  type LocalVideoTrack,
  type RemoteTrackPublication,
  type RemoteVideoTrack,
  type Room,
} from 'livekit-client';

import { getScreenSharePublishSettings } from './screenshare-publish-settings';

/**
 * Screenshare quality log (#2742), for comparing sharer settings on a preview. Off by default;
 * turned on per browser from the share settings panel. While on, every 2 s it records what the
 * sharer actually sends (capture size, each encoding's size, fps, bitrate and what limits it) and
 * what each viewer actually receives (size, fps, bitrate, freezes, the layers on offer, the tile
 * size). Entries go to the console as `[hypha.share]` and to a buffer the panel can copy.
 */

const STORAGE_KEY = 'hypha.call.shareDiagnostics';
const SAMPLE_MS = 2000;
const MAX_ENTRIES = 1500;

type Entry = Record<string, unknown>;

const listeners = new Set<() => void>();
const entries: string[] = [];
let enabled: boolean | null = null;
let version = 0;

function notify() {
  version += 1;
  for (const l of listeners) l();
}

export function isShareDiagnosticsEnabled(): boolean {
  if (enabled === null) {
    try {
      enabled =
        typeof window !== 'undefined' &&
        window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      enabled = false;
    }
  }
  return enabled;
}

export function setShareDiagnosticsEnabled(next: boolean): void {
  enabled = next;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the switch lasts for this page.
  }
  notify();
}

/** Adds one entry (when the log is on): console plus the copyable buffer. */
export function recordShareDiagnostic(entry: Entry): void {
  if (!isShareDiagnosticsEnabled()) return;
  const row = { t: new Date().toISOString(), ...entry };
  try {
    console.info('[hypha.share]', row);
  } catch {
    // ignore
  }
  entries.push(JSON.stringify(row));
  if (entries.length > MAX_ENTRIES)
    entries.splice(0, entries.length - MAX_ENTRIES);
  notify();
}

/** The log as JSON lines, oldest first. */
export function getShareDiagnosticsLog(): string {
  return entries.join('\n');
}

export function clearShareDiagnosticsLog(): void {
  entries.length = 0;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `{ enabled, count }` for the settings panel. */
export function useShareDiagnostics(): { enabled: boolean; count: number } {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return { enabled: isShareDiagnosticsEnabled(), count: entries.length };
}

// ---- Sampling ----

type StatsLike = Record<string, unknown> & { id: string; type: string };

function statsList(report: RTCStatsReport): StatsLike[] {
  const out: StatsLike[] = [];
  report.forEach((s) => out.push(s as StatsLike));
  return out;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function round(v: number | undefined, digits = 0): number | undefined {
  if (v === undefined) return undefined;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function codecOf(list: StatsLike[], codecId: unknown): string | undefined {
  const c = list.find((s) => s.id === codecId);
  const mime = typeof c?.mimeType === 'string' ? c.mimeType : undefined;
  return mime?.split('/')[1];
}

/** The candidate pair in use: Chrome reports it through the transport. */
function selectedPair(list: StatsLike[]): StatsLike | undefined {
  const transport = list.find((s) => s.type === 'transport');
  const byTransport = list.find(
    (s) => s.id === transport?.selectedCandidatePairId,
  );
  return (
    byTransport ??
    list.find(
      (s) =>
        s.type === 'candidate-pair' &&
        s.state === 'succeeded' &&
        s.nominated === true,
    )
  );
}

/** kbps from the byte counter since the previous sample of the same stream. */
function makeRate() {
  const prev = new Map<string, { bytes: number; at: number }>();
  return (key: string, bytes: number | undefined, at: number) => {
    if (bytes === undefined) return undefined;
    const last = prev.get(key);
    prev.set(key, { bytes, at });
    if (!last || at <= last.at || bytes < last.bytes) return undefined;
    return Math.round(((bytes - last.bytes) * 8) / (at - last.at));
  };
}

async function sampleSender(
  label: string,
  sender: RTCRtpSender,
  rate: ReturnType<typeof makeRate>,
) {
  const list = statsList(await sender.getStats());
  const now = performance.now();
  const encodings = sender.getParameters().encodings ?? [];
  const outbound = list
    .filter((s) => s.type === 'outbound-rtp' && s.kind === 'video')
    .map((s) => {
      const rid = typeof s.rid === 'string' ? s.rid : undefined;
      const enc = encodings.find((e) => (e.rid ?? undefined) === rid);
      return {
        rid,
        active: enc?.active,
        w: num(s.frameWidth),
        h: num(s.frameHeight),
        fps: round(num(s.framesPerSecond)),
        kbps: rate(`${label}:${s.id}`, num(s.bytesSent), now),
        targetKbps: round((num(s.targetBitrate) ?? 0) / 1000) || undefined,
        maxKbps: enc?.maxBitrate
          ? Math.round(enc.maxBitrate / 1000)
          : undefined,
        maxFps: enc?.maxFramerate,
        scaleDown: enc?.scaleResolutionDownBy,
        limit: s.qualityLimitationReason,
        svc: s.scalabilityMode,
        codec: codecOf(list, s.codecId),
        encoder: s.encoderImplementation,
        hw: s.powerEfficientEncoder,
        nack: num(s.nackCount),
        pli: num(s.pliCount),
      };
    });
  const pair = selectedPair(list);
  return {
    sender: label,
    outbound,
    uplinkKbps:
      round((num(pair?.availableOutgoingBitrate) ?? 0) / 1000) || undefined,
    rttMs: round((num(pair?.currentRoundTripTime) ?? 0) * 1000) || undefined,
  };
}

async function sampleLocalShare(room: Room, rate: ReturnType<typeof makeRate>) {
  const pub = room.localParticipant.getTrackPublication(
    Track.Source.ScreenShare,
  );
  const track = pub?.videoTrack as LocalVideoTrack | undefined;
  if (!track?.sender) return;
  const capture = track.mediaStreamTrack.getSettings();
  const senders: Array<Awaited<ReturnType<typeof sampleSender>>> = [
    await sampleSender('main', track.sender, rate),
  ];
  for (const [codec, info] of track.simulcastCodecs) {
    if (info.sender && info.sender !== track.sender) {
      senders.push(await sampleSender(`backup:${codec}`, info.sender, rate));
    }
  }
  recordShareDiagnostic({
    side: 'send',
    connection: room.localParticipant.connectionQuality,
    settings: getScreenSharePublishSettings(),
    capture: {
      w: capture.width,
      h: capture.height,
      fps: capture.frameRate,
      surface: (capture as { displaySurface?: string }).displaySurface,
      hint: track.mediaStreamTrack.contentHint || undefined,
    },
    senders,
  });
}

async function sampleRemoteShare(
  participantName: string,
  connectionQuality: string,
  pub: RemoteTrackPublication,
  rate: ReturnType<typeof makeRate>,
) {
  const track = pub.videoTrack as RemoteVideoTrack | undefined;
  const receiver = track?.receiver;
  const base = {
    side: 'receive',
    from: participantName,
    senderConnection: connectionQuality,
    sid: pub.trackSid,
    subscribed: pub.isSubscribed,
    requested: pub.videoQuality,
    published: pub.dimensions,
    layers: pub.trackInfo?.layers?.map((l) => ({
      q: l.quality,
      w: l.width,
      h: l.height,
      kbps: l.bitrate ? Math.round(l.bitrate / 1000) : undefined,
    })),
    codecs: pub.trackInfo?.codecs?.map((c) => c.mimeType.split('/')[1]),
  };
  if (!track || !receiver) {
    recordShareDiagnostic(base);
    return;
  }
  const list = statsList(await receiver.getStats());
  const now = performance.now();
  const s = list.find((x) => x.type === 'inbound-rtp' && x.kind === 'video');
  const pair = selectedPair(list);
  const el = track.attachedElements.find(
    (e): e is HTMLVideoElement =>
      e instanceof HTMLVideoElement && e.isConnected,
  );
  recordShareDiagnostic({
    ...base,
    streamState: track.streamState,
    inbound: s
      ? {
          w: num(s.frameWidth),
          h: num(s.frameHeight),
          fps: round(num(s.framesPerSecond)),
          kbps: rate(`recv:${pub.trackSid}`, num(s.bytesReceived), now),
          codec: codecOf(list, s.codecId),
          decoder: s.decoderImplementation,
          dropped: num(s.framesDropped),
          freezes: num(s.freezeCount),
          freezeSec: round(num(s.totalFreezesDuration), 1),
          lost: num(s.packetsLost),
          jitterMs: round((num(s.jitter) ?? 0) * 1000) || undefined,
          nack: num(s.nackCount),
          pli: num(s.pliCount),
        }
      : undefined,
    downlinkKbps:
      round((num(pair?.availableIncomingBitrate) ?? 0) / 1000) || undefined,
    tile: el
      ? {
          cssW: el.clientWidth,
          cssH: el.clientHeight,
          dpr: el.ownerDocument.defaultView?.devicePixelRatio,
          videoW: el.videoWidth,
          videoH: el.videoHeight,
          tiles: track.attachedElements.length,
        }
      : undefined,
  });
}

/**
 * Samples the local and remote screenshares of `room` every 2 s while the log is on. Returns a
 * stop function. Cheap when off: one flag check per tick.
 */
export function startShareDiagnostics(room: Room): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const rate = makeRate();
  let busy = false;
  const tick = async () => {
    if (busy || !isShareDiagnosticsEnabled()) return;
    busy = true;
    try {
      await sampleLocalShare(room, rate);
      for (const p of room.remoteParticipants.values()) {
        const pub = p.getTrackPublication(Track.Source.ScreenShare) as
          | RemoteTrackPublication
          | undefined;
        if (pub) {
          await sampleRemoteShare(
            p.name || p.identity,
            p.connectionQuality,
            pub,
            rate,
          );
        }
      }
    } catch (err) {
      recordShareDiagnostic({ side: 'error', message: String(err) });
    } finally {
      busy = false;
    }
  };
  const id = window.setInterval(() => void tick(), SAMPLE_MS);
  return () => window.clearInterval(id);
}
