import { describe, expect, it, vi, beforeEach } from 'vitest';
import { logGroupCallSimulcastCapabilityAudit } from '../call-video-simulcast-audit';
import { logSpaceGroupCallEvent } from '../space-group-call-telemetry';

vi.mock('../space-group-call-telemetry', () => ({
  logSpaceGroupCallEvent: vi.fn(),
}));

describe('logGroupCallSimulcastCapabilityAudit', () => {
  beforeEach(() => {
    vi.mocked(logSpaceGroupCallEvent).mockClear();
  });

  it('records mesh group call simulcast unavailability for WCUX-QUALITY-2', () => {
    logGroupCallSimulcastCapabilityAudit({
      roomId: '!room:hs',
      groupCallId: 'gc-1',
    });

    expect(logSpaceGroupCallEvent).toHaveBeenCalledWith({
      name: 'hypha.group_call.simulcast_audit',
      roomId: '!room:hs',
      groupCallId: 'gc-1',
      simulcastAvailable: false,
      meshGroupCall: true,
      note: expect.stringContaining('simulcast'),
    });
  });
});
