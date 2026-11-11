import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  proposalDiscussionRoomTitle,
  resolveQuestDiscussionRoomId,
} from '../quest-discussion-room';

const base = {
  proposalSlug: 'proposal-1' as string | null,
  proposalTitle: 'Onboarding',
  authToken: 'token' as string | null,
  loadProposalRoomId: vi.fn(async () => null as string | null),
  createProposalRoom: vi.fn(async () => '!created:room'),
  persistProposalRoomId: vi.fn(async () => undefined),
};

describe('resolveQuestDiscussionRoomId', () => {
  beforeEach(() => {
    base.loadProposalRoomId.mockClear();
    base.createProposalRoom.mockReset();
    base.createProposalRoom.mockResolvedValue('!created:room');
    base.persistProposalRoomId.mockReset();
    base.persistProposalRoomId.mockResolvedValue(undefined);
  });

  it('names a proposal room the same way proposal discussion does', () => {
    expect(proposalDiscussionRoomTitle('Onboarding')).toBe(
      'Proposal: Onboarding',
    );
    expect(proposalDiscussionRoomTitle('  ')).toBe('Proposal discussion');
  });

  it('uses the quest room and does not touch the proposal', async () => {
    const loadProposalRoomId = vi.fn(async () => '!proposal:room');
    const createProposalRoom = vi.fn(async () => '!created:room');
    const roomId = await resolveQuestDiscussionRoomId({
      ...base,
      questRoomId: ' !quest:room ',
      loadProposalRoomId,
      createProposalRoom,
    });
    expect(roomId).toBe('!quest:room');
    expect(loadProposalRoomId).not.toHaveBeenCalled();
    expect(createProposalRoom).not.toHaveBeenCalled();
  });

  it('uses the proposal room already stored on the quest', async () => {
    const loadProposalRoomId = vi.fn(async () => '!other:room');
    const createProposalRoom = vi.fn(async () => '!created:room');
    const roomId = await resolveQuestDiscussionRoomId({
      ...base,
      questRoomId: null,
      proposalRoomId: ' !proposal:stored ',
      loadProposalRoomId,
      createProposalRoom,
    });
    expect(roomId).toBe('!proposal:stored');
    expect(loadProposalRoomId).not.toHaveBeenCalled();
    expect(createProposalRoom).not.toHaveBeenCalled();
  });

  it('joins an existing proposal room when the quest has none', async () => {
    const loadProposalRoomId = vi.fn(async () => ' !proposal:room ');
    const createProposalRoom = vi.fn(async () => '!created:room');
    const roomId = await resolveQuestDiscussionRoomId({
      ...base,
      questRoomId: null,
      loadProposalRoomId,
      createProposalRoom,
    });
    expect(roomId).toBe('!proposal:room');
    expect(loadProposalRoomId).toHaveBeenCalledWith('proposal-1');
    expect(createProposalRoom).not.toHaveBeenCalled();
  });

  it('creates and stores a proposal room when neither room exists', async () => {
    const persistProposalRoomId = vi.fn(async () => undefined);
    const roomId = await resolveQuestDiscussionRoomId({
      ...base,
      questRoomId: '  ',
      persistProposalRoomId,
    });
    expect(roomId).toBe('!created:room');
    expect(base.createProposalRoom).toHaveBeenCalledWith(
      'Proposal: Onboarding',
    );
    expect(persistProposalRoomId).toHaveBeenCalledWith(
      'proposal-1',
      '!created:room',
    );
  });

  it('still opens a created room when storing it fails', async () => {
    const roomId = await resolveQuestDiscussionRoomId({
      ...base,
      questRoomId: null,
      persistProposalRoomId: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    expect(roomId).toBe('!created:room');
  });

  it('does not create a room that cannot be stored', async () => {
    const createProposalRoom = vi.fn(async () => '!created:room');
    const roomId = await resolveQuestDiscussionRoomId({
      ...base,
      questRoomId: null,
      authToken: null,
      createProposalRoom,
    });
    expect(roomId).toBeNull();
    expect(createProposalRoom).not.toHaveBeenCalled();
  });

  it('returns null when the quest has no room and no proposal', async () => {
    const roomId = await resolveQuestDiscussionRoomId({
      ...base,
      questRoomId: null,
      proposalSlug: null,
    });
    expect(roomId).toBeNull();
  });
});
