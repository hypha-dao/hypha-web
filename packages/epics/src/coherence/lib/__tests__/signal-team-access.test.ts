import { describe, expect, it } from 'vitest';
import {
  SIGNAL_TEAM_EVENT_BODY_MARKER,
  SIGNAL_TEAM_EVENT_KIND,
  isSignalTeamRosterContent,
  readSignalTeamRosterFromEvents,
} from '../../utils/signal-team-access';

function messageEvent(content: Record<string, unknown>) {
  return {
    getType: () => 'm.room.message',
    getContent: () => content,
  };
}

describe('signal-team-access', () => {
  it('recognizes the picker / publishSignalTeamNotice roster shape', () => {
    expect(
      isSignalTeamRosterContent({
        msgtype: 'm.notice',
        body: SIGNAL_TEAM_EVENT_BODY_MARKER,
        memberMatrixUserIds: ['@alice:example.org'],
      }),
    ).toBe(true);
  });

  it('still recognizes the legacy custom msgtype', () => {
    expect(
      isSignalTeamRosterContent({
        msgtype: SIGNAL_TEAM_EVENT_KIND,
        body: 'signal team members updated',
        memberMatrixUserIds: ['@alice:example.org'],
      }),
    ).toBe(true);
  });

  it('ignores ordinary chat messages', () => {
    expect(
      isSignalTeamRosterContent({
        msgtype: 'm.text',
        body: 'hello',
      }),
    ).toBe(false);
  });

  it('reads the last picker-shaped roster as the Signal Team source of truth', () => {
    const roster = readSignalTeamRosterFromEvents(
      [
        messageEvent({
          msgtype: 'm.text',
          body: 'description',
        }),
        messageEvent({
          msgtype: 'm.notice',
          body: SIGNAL_TEAM_EVENT_BODY_MARKER,
          coherenceSlug: 'coh-2773e412',
          memberMatrixUserIds: ['@grok:example.org', '@vlad:example.org'],
          ownerMatrixUserId: '@vlad:example.org',
        }),
      ],
      'coh-2773e412',
    );

    expect(roster.hasPolicy).toBe(true);
    expect(roster.memberMatrixUserIds).toEqual([
      '@grok:example.org',
      '@vlad:example.org',
    ]);
    expect(roster.ownerMatrixUserId).toBe('@vlad:example.org');
  });

  it('skips roster notices for a different signal slug', () => {
    const roster = readSignalTeamRosterFromEvents(
      [
        messageEvent({
          msgtype: 'm.notice',
          body: SIGNAL_TEAM_EVENT_BODY_MARKER,
          coherenceSlug: 'coh-other',
          memberMatrixUserIds: ['@other:example.org'],
          ownerMatrixUserId: '@other:example.org',
        }),
      ],
      'coh-2773e412',
    );
    expect(roster.hasPolicy).toBe(false);
    expect(roster.memberMatrixUserIds).toEqual([]);
  });
});
