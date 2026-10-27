import { describe, expect, it } from 'vitest';
import {
  SIGNAL_TEAM_EVENT_BODY_MARKER,
  SIGNAL_TEAM_EVENT_KIND,
  SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER,
  SIGNAL_TEAM_REQUEST_EVENT_KIND,
  isSignalTeamRequestContent,
  isSignalTeamRosterContent,
  isTrustedSignalTeamSender,
  readSignalTeamRosterFromEvents,
  rosterIdsIntersectSpaceMap,
  unmappedPersonIds,
} from '../../utils/signal-team-access';

function messageEvent(
  content: Record<string, unknown>,
  sender = '@admin:example.org',
) {
  return {
    getType: () => 'm.room.message',
    getContent: () => content,
    getSender: () => sender,
  };
}

function rosterContent(
  members: string[],
  owner: string,
): Record<string, unknown> {
  return {
    msgtype: 'm.notice',
    body: SIGNAL_TEAM_EVENT_BODY_MARKER,
    coherenceSlug: 'coh-2773e412',
    memberMatrixUserIds: members,
    ownerMatrixUserId: owner,
  };
}

const roomPower = (userId: string | null) =>
  userId === '@admin:example.org' ? 100 : 0;

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

  it('recognizes legacy request notices by msgtype', () => {
    expect(
      isSignalTeamRequestContent({
        msgtype: SIGNAL_TEAM_REQUEST_EVENT_KIND,
        body: 'signal team access requested',
        requesterMatrixUserId: '@bob:example.org',
      }),
    ).toBe(true);
    expect(
      isSignalTeamRequestContent({
        msgtype: 'm.notice',
        body: SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER,
        requesterMatrixUserId: '@bob:example.org',
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

  it('does not trust a sender who only claims ownership in event content', () => {
    expect(
      isTrustedSignalTeamSender({
        senderId: '@forger:example.org',
        establishedOwnerMatrixUserId: null,
        establishedMemberMatrixUserIds: [],
        powerLevel: 0,
      }),
    ).toBe(false);
    expect(
      isTrustedSignalTeamSender({
        senderId: '@admin:example.org',
        establishedOwnerMatrixUserId: '@admin:example.org',
        establishedMemberMatrixUserIds: [],
        powerLevel: 0,
      }),
    ).toBe(true);
    expect(
      isTrustedSignalTeamSender({
        senderId: '@member:example.org',
        establishedOwnerMatrixUserId: '@admin:example.org',
        establishedMemberMatrixUserIds: ['@member:example.org'],
        powerLevel: 0,
      }),
    ).toBe(true);
    expect(
      isTrustedSignalTeamSender({
        senderId: '@mod:example.org',
        establishedOwnerMatrixUserId: '@admin:example.org',
        establishedMemberMatrixUserIds: [],
        powerLevel: 50,
      }),
    ).toBe(true);
  });

  it('reads the last trusted picker-shaped roster as the Signal Team source of truth', () => {
    const roster = readSignalTeamRosterFromEvents(
      [
        messageEvent({
          msgtype: 'm.text',
          body: 'description',
        }),
        messageEvent(
          rosterContent(
            ['@grok:example.org', '@vlad:example.org'],
            '@vlad:example.org',
          ),
        ),
      ],
      'coh-2773e412',
      { getPowerLevel: roomPower },
    );

    expect(roster.hasPolicy).toBe(true);
    expect(roster.memberMatrixUserIds).toEqual([
      '@grok:example.org',
      '@vlad:example.org',
    ]);
    expect(roster.ownerMatrixUserId).toBe('@vlad:example.org');
  });

  it('ignores a forged roster event after a valid one', () => {
    const roster = readSignalTeamRosterFromEvents(
      [
        messageEvent(
          rosterContent(
            ['@grok:example.org', '@vlad:example.org'],
            '@vlad:example.org',
          ),
          '@admin:example.org',
        ),
        messageEvent(
          rosterContent(['@forger:example.org'], '@forger:example.org'),
          '@forger:example.org',
        ),
      ],
      'coh-2773e412',
      { getPowerLevel: roomPower },
    );

    expect(roster.hasPolicy).toBe(true);
    expect(roster.memberMatrixUserIds).toEqual([
      '@grok:example.org',
      '@vlad:example.org',
    ]);
    expect(roster.ownerMatrixUserId).toBe('@vlad:example.org');
  });

  it('rejects a first roster event from a low-power sender claiming ownership', () => {
    const roster = readSignalTeamRosterFromEvents(
      [
        messageEvent(
          rosterContent(['@forger:example.org'], '@forger:example.org'),
          '@forger:example.org',
        ),
      ],
      'coh-2773e412',
      { getPowerLevel: roomPower },
    );

    expect(roster.hasPolicy).toBe(false);
    expect(roster.memberMatrixUserIds).toEqual([]);
    expect(roster.ownerMatrixUserId).toBeNull();
  });

  it('treats a getUserId-only roster as unusable when it misses the space map', () => {
    expect(
      rosterIdsIntersectSpaceMap(['@session:example.org'], {
        1: '@prod_privy_vlad:example.org',
        2: '@prod_privy_grok:example.org',
      }),
    ).toBe(false);
    expect(
      rosterIdsIntersectSpaceMap(
        ['@prod_privy_vlad:example.org', '@session:example.org'],
        {
          1: '@prod_privy_vlad:example.org',
          2: '@prod_privy_grok:example.org',
        },
      ),
    ).toBe(true);
  });

  it('lists assignees that are missing from the person→Matrix map', () => {
    expect(
      unmappedPersonIds([10, 20, 30], {
        10: '@prod_privy_grok:example.org',
        20: '  ',
      }),
    ).toEqual([20, 30]);
    expect(
      unmappedPersonIds([10], { 10: '@prod_privy_grok:example.org' }),
    ).toEqual([]);
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
      { getPowerLevel: roomPower },
    );
    expect(roster.hasPolicy).toBe(false);
    expect(roster.memberMatrixUserIds).toEqual([]);
  });
});
