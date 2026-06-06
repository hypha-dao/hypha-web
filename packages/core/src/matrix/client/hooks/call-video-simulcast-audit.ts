import { logSpaceGroupCallEvent } from './space-group-call-telemetry';

/**
 * WCUX-QUALITY-2 audit: matrix-js-sdk@40 mesh `GroupCall` uses pairwise
 * `MatrixCall` peer connections without a public simulcast layer API.
 */
export function logGroupCallSimulcastCapabilityAudit(options: {
  roomId: string;
  groupCallId: string;
}): void {
  logSpaceGroupCallEvent({
    name: 'hypha.group_call.simulcast_audit',
    roomId: options.roomId,
    groupCallId: options.groupCallId,
    simulcastAvailable: false,
    meshGroupCall: true,
    note: 'matrix-js-sdk@40 GroupCall has no simulcast layer API; quality uses capture constraints and receiver downscale',
  });
}
