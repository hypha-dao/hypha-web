import { describe, expect, it, vi } from 'vitest';
import {
  formatSignalTeamUpdateDisplayBody,
  matrixUserIdsForPersonIds,
  parseSignalTeamNoticeFromWireContent,
  publishSignalTeamNotice,
  resolveSignalTeamUpdateDisplayBody,
  shouldIncludeSignalTeamNoticeInChatTimeline,
} from '../signal-team-events';

describe('signal-team-events', () => {
  it('formats added and removed members with full MXIDs', () => {
    expect(
      formatSignalTeamUpdateDisplayBody(
        ['@prod_privy_abc:srv1294735.hstgr.cloud'],
        ['@prod_privy_def:srv1294735.hstgr.cloud'],
      ),
    ).toBe(
      'signal team updated: added @prod_privy_abc:srv1294735.hstgr.cloud; removed @prod_privy_def:srv1294735.hstgr.cloud',
    );
  });

  it('rebuilds display body from structured wire content', () => {
    expect(
      resolveSignalTeamUpdateDisplayBody(
        {
          addedMemberMatrixUserIds: ['@prod_privy_abc:srv1294735.hstgr.cloud'],
        },
        '[hypha:signal-team] signal team updated: added @prod_privy...abc:srv1294735.hstgr.cloud',
      ),
    ).toBe('signal team updated: added @prod_privy_abc:srv1294735.hstgr.cloud');
  });

  it('parses structured signal team updates from marker-only bodies', () => {
    expect(
      parseSignalTeamNoticeFromWireContent(
        {
          addedMemberMatrixUserIds: ['@prod_privy_abc:srv1294735.hstgr.cloud'],
          removedMemberMatrixUserIds: [
            '@prod_privy_def:srv1294735.hstgr.cloud',
          ],
        },
        '[hypha:signal-team]',
      ),
    ).toEqual({
      kind: 'updated',
      addedMemberMatrixUserIds: ['@prod_privy_abc:srv1294735.hstgr.cloud'],
      removedMemberMatrixUserIds: ['@prod_privy_def:srv1294735.hstgr.cloud'],
    });
  });

  it('parses signal team request notices from marker-only bodies', () => {
    expect(
      parseSignalTeamNoticeFromWireContent(
        { status: 'pending' },
        '[hypha:signal-team-request]',
      ),
    ).toEqual({
      kind: 'access_requested',
      addedMemberMatrixUserIds: [],
      removedMemberMatrixUserIds: [],
    });
  });

  it('excludes roster snapshot notices from chat timeline', () => {
    const notice = parseSignalTeamNoticeFromWireContent(
      {
        memberMatrixUserIds: ['@alice:example.org'],
      },
      '[hypha:signal-team]',
    );
    expect(notice?.kind).toBe('members_updated');
    expect(shouldIncludeSignalTeamNoticeInChatTimeline(notice)).toBe(false);
    expect(
      shouldIncludeSignalTeamNoticeInChatTimeline({
        kind: 'access_requested',
        addedMemberMatrixUserIds: [],
        removedMemberMatrixUserIds: [],
      }),
    ).toBe(true);
  });

  it('maps assignee person ids onto unique Matrix user ids', () => {
    expect(
      matrixUserIdsForPersonIds([3, 7, 3, 9], {
        3: '@alice:example.org',
        7: '  @bob:example.org  ',
        9: '',
      }),
    ).toEqual(['@alice:example.org', '@bob:example.org']);
    expect(matrixUserIdsForPersonIds([], { 3: '@alice:example.org' })).toEqual(
      [],
    );
  });

  it('publishes create-time assignees as the signal team roster', async () => {
    const sendEvent = vi.fn().mockResolvedValue({ event_id: '$evt' });
    await publishSignalTeamNotice({
      client: { sendEvent },
      roomId: '!signal:example.org',
      coherenceSlug: 'coh-abc123',
      memberMatrixUserIds: ['@alice:example.org', '@bob:example.org'],
      ownerMatrixUserId: '@creator:example.org',
      actorMatrixUserId: '@creator:example.org',
      addedMemberMatrixUserIds: ['@alice:example.org', '@bob:example.org'],
    });

    expect(sendEvent).toHaveBeenCalledTimes(1);
    const [, , content] = sendEvent.mock.calls[0]!;
    expect(content.coherenceSlug).toBe('coh-abc123');
    expect(content.memberMatrixUserIds).toEqual([
      '@alice:example.org',
      '@bob:example.org',
      '@creator:example.org',
    ]);
    expect(content.addedMemberMatrixUserIds).toEqual([
      '@alice:example.org',
      '@bob:example.org',
    ]);
    expect(content.ownerMatrixUserId).toBe('@creator:example.org');
  });
});
