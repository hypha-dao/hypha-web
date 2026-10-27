import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../my-connections.tsx'),
  'utf8',
);

describe('group picker chips and radio', () => {
  it('keeps the search needle when a selected chip is removed', () => {
    expect(source).toContain('membersForGroupPicker(titledMembers, picking)');
    expect(source).toContain('conversationsMatchingSearch');
    expect(source).toContain('picking || Boolean(query.trim())');
    expect(source).toContain('mergeDirectoryPeople');
    expect(source).toContain('onClick={() => toggleSelected(row)}');
    expect(source).not.toMatch(/toggleSelected\(row\);\s*setQuery\(/);
    expect(source).toMatch(/function exitPicking\(\) \{[\s\S]*setQuery\(''\)/);
  });

  it('resolves Matrix ids for every pick before createRoom', () => {
    expect(source).toContain('resolvedMatrixIdsForGroup');
    expect(source).toContain('disabled={!canStartGroup}');
    const resolveAt = source.indexOf(
      'const memberIds = resolvedMatrixIdsForGroup',
    );
    const createAt = source.indexOf('createRoom(title,');
    expect(resolveAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(resolveAt);
  });

  it('selects a member when the radio circle is tapped', () => {
    expect(source).toContain('onClick={(event) => {');
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain('onOpen(row)');
  });

  it('opens a listed conversation by its room id', () => {
    expect(source).toContain('listedConversationOpenTarget(row, {');
    expect(source).toContain("target?.kind === 'listed-room'");
    expect(source).toContain('openCoherenceChat(target.roomId, target.title');
    expect(source).toContain('peopleBySub');
    expect(source).not.toContain('row.person.id < 0 && row.roomId');
  });

  it('summarises priority DMs without waiting for Load more', () => {
    expect(source).toContain('recentDirectRoomIds');
    expect(source).toContain('PRIORITY_DM_BUDGET');
    expect(source).toContain('pumpPriorityConversationRooms');
    expect(source).not.toMatch(/if \(matrixUserIds\.length === 0\) return;/);
    expect(source).toContain('...peerPersonIds');
  });

  it('opens a listed person even when Matrix id lookup fails', () => {
    const home = readFileSync(
      resolve(__dirname, '../member-home-people.tsx'),
      'utf8',
    );
    expect(home).toContain(
      "noticeKeyForOpenPersonRoomError(error) === 'matrixPersonUnavailable'",
    );
    expect(home).toContain("status: 'start-conversation'");
    expect(home).toContain("result.status === 'failed'");
    expect(home).toContain("result.status === 'ready'");
    expect(home).toContain("result.status === 'start-conversation'");
    expect(home).toContain("setNotice(t('matrixPersonUnavailable'))");
    expect(home).toContain('showRoom(null, title, person)');
    expect(home).toContain('showRoom(result.roomId, title, person)');
    expect(home).toContain('rememberPersonDirectRoom');
    expect(source).toContain('readRememberedPersonDirectRoom(row.person.id)');
  });

  it('lets every letter reach the messages search field', () => {
    expect(source).toContain("if (event.key === 'Escape') return;");
    expect(source).toContain('event.stopPropagation()');
  });

  it('holds PEOPLE AROUND behind a list skeleton until the conversation list settles', () => {
    expect(source).toContain('messagesPeopleListReady');
    expect(source).toContain('initialSyncComplete');
    expect(source).toContain('MemberListSkeleton');
    expect(source).toContain('data-testid="messages-people-loader"');
    expect(source).toContain('previewLoading={false}');
    expect(source).toContain('!listLoading && people.length > 0');
    expect(source).toContain(
      'if (dataReady && isMatrixAvailable) setListSettled(true)',
    );
    expect(source).not.toMatch(/if \(dataReady\) setListSettled\(true\)/);
    expect(source).not.toMatch(/isConnecting \? t\('loading'\)/);
  });
});
