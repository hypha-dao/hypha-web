/**
 * Privacy-safe, client-only telemetry for group calls. No PII; room id is
 * a Matrix opaque id. Enable debug logs in dev via the browser console filter
 * "hypha.group_call".
 */

export type SpaceGroupCallTelemetryEvent = {
  name:
    | 'hypha.group_call.join_ms'
    | 'hypha.group_call.left'
    | 'hypha.group_call.error';
  roomId: string;
  kind?: 'audio' | 'video';
  joinMs?: number;
  errorCode?: string;
  reason?: 'user' | 'error' | 'room' | 'unmount';
};

export function logSpaceGroupCallEvent(
  event: SpaceGroupCallTelemetryEvent,
): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    if (process.env.NODE_ENV === 'development') {
      console.info('[hypha.group_call]', event);
    }
  } catch {
    // ignore
  }
}
