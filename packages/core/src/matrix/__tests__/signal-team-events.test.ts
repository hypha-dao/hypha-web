import { describe, expect, it } from 'vitest';
import {
  formatSignalTeamUpdateDisplayBody,
  parseSignalTeamNoticeFromWireContent,
  resolveSignalTeamUpdateDisplayBody,
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
});
