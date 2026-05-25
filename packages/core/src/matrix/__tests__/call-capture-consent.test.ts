import { EventType } from 'matrix-js-sdk';
import { describe, expect, it } from 'vitest';
import {
  resolveActiveRoomCaptureFromEvents,
  resolveCaptureConsent,
  resolveLocalCaptureConsent,
} from '../client/hooks/call-capture-consent';

function mockCaptureEvent(params: {
  action: 'started' | 'stopped';
  mode?: 'transcript_only' | 'recording_with_transcript';
  sender?: string;
}) {
  return {
    getType: () => EventType.RoomMessage,
    getSender: () => params.sender ?? '@alice:example.org',
    getContent: () => ({
      'io.hypha.call_capture_notice.v1': true,
      action: params.action,
      mode: params.mode ?? 'recording_with_transcript',
    }),
  };
}

describe('call-capture-consent', () => {
  it('returns active capture from the newest started notice', () => {
    const eventsNewestFirst = [
      mockCaptureEvent({ action: 'started', sender: '@bob:example.org' }),
    ];

    expect(
      resolveActiveRoomCaptureFromEvents(
        eventsNewestFirst,
        (sender) => (sender === '@bob:example.org' ? 'Bob' : sender),
        '@alice:example.org',
      ),
    ).toEqual({
      actor: 'Bob',
      actorUserId: '@bob:example.org',
      mode: 'recording_with_transcript',
      isLocalInitiator: false,
    });
  });

  it('clears capture when the newest notice is stopped', () => {
    const eventsNewestFirst = [
      mockCaptureEvent({ action: 'stopped' }),
      mockCaptureEvent({ action: 'started' }),
    ];

    expect(
      resolveActiveRoomCaptureFromEvents(
        eventsNewestFirst,
        (sender) => sender,
        null,
      ),
    ).toBeNull();
  });

  it('prefers local capture while recording is active', () => {
    const local = resolveLocalCaptureConsent({
      captureMode: 'transcript_only',
      recordingStatus: 'recording',
    });
    const merged = resolveCaptureConsent(
      {
        actor: 'Bob',
        actorUserId: '@bob:example.org',
        mode: 'recording_with_transcript',
        isLocalInitiator: false,
      },
      local,
    );

    expect(merged).toEqual({
      actor: '',
      actorUserId: '',
      mode: 'transcript_only',
      isLocalInitiator: true,
      paused: false,
    });
  });
});
