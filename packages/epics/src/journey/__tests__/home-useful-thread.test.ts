import { describe, expect, it } from 'vitest';
import {
  agendaKeysInThread,
  appendAgendaBlock,
  appendLocalAiBlock,
  appendUserBlock,
  attentionItemKey,
  nextUnseenAttentionItem,
  remainingAfterSeen,
  upsertChatAiBlock,
  type UsefulThreadBlock,
} from '../home-useful-thread';

const vote = { kind: 'vote', id: 'garden:1' };
const task = { kind: 'task', id: 'acaw:2' };
const signal = { kind: 'signal', id: 'honey:3' };

describe('home useful thread', () => {
  it('never replaces a previous agenda block when the next item arrives', () => {
    let blocks: UsefulThreadBlock[] = [];
    blocks = appendAgendaBlock(blocks, attentionItemKey(vote), 'a1');
    blocks = appendUserBlock(blocks, 'Not now.', 'u1');
    blocks = appendLocalAiBlock(blocks, 'Okay. Next on the agenda.', 'ai1');
    blocks = appendAgendaBlock(blocks, attentionItemKey(task), 'a2');

    expect(agendaKeysInThread(blocks)).toEqual([
      'vote:garden:1',
      'task:acaw:2',
    ]);
    expect(blocks.map((block) => block.type)).toEqual([
      'agenda',
      'user',
      'ai',
      'agenda',
    ]);
  });

  it('hands the next unseen item after skip or take, without dropping history', () => {
    const items = [vote, task, signal];
    const seen = new Set([attentionItemKey(vote)]);
    expect(nextUnseenAttentionItem(items, seen)).toEqual(task);
    seen.add(attentionItemKey(task));
    expect(nextUnseenAttentionItem(items, seen)).toEqual(signal);
    seen.add(attentionItemKey(signal));
    expect(nextUnseenAttentionItem(items, seen)).toBeNull();
  });

  it('updates a streaming assistant reply in place instead of cloning it', () => {
    let blocks: UsefulThreadBlock[] = appendUserBlock([], 'Weigh in', 'u1');
    blocks = upsertChatAiBlock(blocks, 'm-9', 'Hi', true);
    blocks = upsertChatAiBlock(
      blocks,
      'm-9',
      'Hi Alex. The vote is still open.',
      false,
    );

    const ai = blocks.filter((block) => block.type === 'ai');
    expect(ai).toHaveLength(1);
    expect(ai[0]).toMatchObject({
      chatId: 'm-9',
      streaming: false,
      text: 'Hi Alex. The vote is still open.',
    });
  });

  it('counts what is still waiting after acted items stay in the thread', () => {
    expect(remainingAfterSeen(10, 1)).toBe(9);
    expect(remainingAfterSeen(1, 1)).toBe(0);
  });
});
