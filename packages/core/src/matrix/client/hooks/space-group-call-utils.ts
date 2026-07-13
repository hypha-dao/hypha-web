import type * as MatrixSdk from 'matrix-js-sdk';
import {
  looksLikeTechnicalMatrixDisplayName,
  matrixMemberDisplayLabel,
} from '../../matrix-member-display';

/**
 * Resolve a human-readable speaker label from Matrix active-speaker state.
 * Falls back to the local user when no active speaker is set (solo calls).
 * When the Matrix label is still a bridged Privy slug, store the full MXID so
 * downstream UI can resolve Hypha profile names.
 */
export function resolveMatrixSpeakerDisplayName(
  client: MatrixSdk.MatrixClient | null | undefined,
  roomId: string | null | undefined,
  activeSpeakerKey: string | null | undefined,
): string {
  if (!client) return 'Speaker';
  let userId = client.getUserId();
  const key = activeSpeakerKey?.trim();
  if (key) {
    const separator = key.indexOf('::');
    const parsedUserId = separator >= 0 ? key.slice(0, separator) : key;
    if (parsedUserId) userId = parsedUserId;
  }
  if (!userId) return 'Speaker';
  const room = roomId?.trim() ? client.getRoom(roomId.trim()) : null;
  const member = room?.getMember(userId);
  const label = member ? matrixMemberDisplayLabel(member, userId) : userId;
  if (looksLikeTechnicalMatrixDisplayName(label, userId)) {
    return userId;
  }
  return label;
}

/**
 * Classifies Matrix GroupCall / getUserMedia failures for UI (permission vs other).
 * @public
 */
export function isPermissionLikeGroupCallError(e: unknown): boolean {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = String((e as { code?: string }).code);
    if (code === 'no_user_media') return true;
  }
  if (e instanceof Error) {
    const name = e.name;
    if (
      name === 'NotAllowedError' ||
      name === 'PermissionDismissedError' /* experimental */ ||
      name === 'SecurityError' ||
      name === 'NotReadableError' ||
      name === 'OverconstrainedError'
    ) {
      return true;
    }
    const m = e.message.toLowerCase();
    return (
      m.includes('notallowederror') ||
      m.includes('permission') ||
      m.includes('not allowed')
    );
  }
  return false;
}

/** True when getUserMedia failed because no matching camera/microphone device exists. */
export function isDeviceNotFoundGroupCallError(e: unknown): boolean {
  return e instanceof Error && e.name === 'NotFoundError';
}

/** True when the homeserver rejected the request for rate limiting (HTTP 429 / M_LIMIT_EXCEEDED). */
export function isMatrixRateLimitedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & {
    httpStatus?: number;
    errcode?: string;
    data?: { errcode?: string; retry_after_ms?: number };
  };
  if (e.httpStatus === 429) return true;
  const msg = e.message;
  if (msg.includes('[429]') || msg.includes(' 429 ')) return true;
  if (e.errcode === 'M_LIMIT_EXCEEDED') return true;
  if (e.data?.errcode === 'M_LIMIT_EXCEEDED') return true;
  if (/too many requests/i.test(msg)) return true;
  return false;
}

/**
 * Non-permission GroupCall errors during an active capture session are often
 * transient (homeserver 429, SDK "multiple calls" races). Teardown would stop
 * recording while the user is still in the call.
 */
export function shouldIgnoreGroupCallErrorDuringCapture(
  err: unknown,
  captureActive: boolean,
): boolean {
  if (isPermissionLikeGroupCallError(err)) return false;
  if (isMatrixRateLimitedError(err)) return true;
  return captureActive;
}

/**
 * While presenting, GroupCall errors must not tear down the whole session —
 * stop share and surface `screenshareErrorCode` instead (see WCUX share spec).
 */
export function resolveGroupCallErrorDuringScreenshare(
  err: unknown,
): 'ignore' | 'screenshare_only' {
  if (isPermissionLikeGroupCallError(err)) return 'screenshare_only';
  if (isMatrixRateLimitedError(err)) return 'ignore';
  return 'screenshare_only';
}

/** Document Picture-in-Picture (Chrome) — not in default TS lib.dom yet. */
export function isDocumentPictureInPictureWindowOpen(): boolean {
  if (typeof window === 'undefined') return false;
  const api = (
    window as Window & {
      documentPictureInPicture?: { window?: Window | null };
    }
  ).documentPictureInPicture;
  return Boolean(api?.window);
}
