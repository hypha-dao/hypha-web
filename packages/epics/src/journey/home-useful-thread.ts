export type UsefulThreadBlock =
  | { id: string; type: 'agenda'; itemKey: string }
  | { id: string; type: 'user'; text: string }
  | {
      id: string;
      type: 'ai';
      text: string;
      source: 'local' | 'chat';
      chatId?: string;
      streaming?: boolean;
    };

export function attentionItemKey(item: { kind: string; id: string }): string {
  return `${item.kind}:${item.id}`;
}

export function nextUnseenAttentionItem<T extends { kind: string; id: string }>(
  items: T[],
  seenKeys: Iterable<string>,
): T | null {
  const seen = new Set(seenKeys);
  return items.find((item) => !seen.has(attentionItemKey(item))) ?? null;
}

export function agendaKeysInThread(blocks: UsefulThreadBlock[]): string[] {
  return blocks
    .filter(
      (block): block is Extract<UsefulThreadBlock, { type: 'agenda' }> =>
        block.type === 'agenda',
    )
    .map((block) => block.itemKey);
}

export function appendAgendaBlock(
  blocks: UsefulThreadBlock[],
  itemKey: string,
  id: string,
): UsefulThreadBlock[] {
  if (
    blocks.some((block) => block.type === 'agenda' && block.itemKey === itemKey)
  ) {
    return blocks;
  }
  return [...blocks, { id, type: 'agenda', itemKey }];
}

export function appendUserBlock(
  blocks: UsefulThreadBlock[],
  text: string,
  id: string,
): UsefulThreadBlock[] {
  const trimmed = text.trim();
  if (!trimmed) return blocks;
  return [...blocks, { id, type: 'user', text: trimmed }];
}

export function appendLocalAiBlock(
  blocks: UsefulThreadBlock[],
  text: string,
  id: string,
): UsefulThreadBlock[] {
  const trimmed = text.trim();
  if (!trimmed) return blocks;
  return [...blocks, { id, type: 'ai', text: trimmed, source: 'local' }];
}

export function upsertChatAiBlock(
  blocks: UsefulThreadBlock[],
  chatId: string,
  text: string,
  streaming: boolean,
): UsefulThreadBlock[] {
  const trimmed = text.trim();
  if (!trimmed && !streaming) return blocks;
  const existing = blocks.findIndex(
    (block) =>
      block.type === 'ai' && block.source === 'chat' && block.chatId === chatId,
  );
  const next: UsefulThreadBlock = {
    id:
      existing >= 0 && blocks[existing]?.type === 'ai'
        ? blocks[existing].id
        : `ai-chat-${chatId}`,
    type: 'ai',
    text: trimmed,
    source: 'chat',
    chatId,
    streaming,
  };
  if (existing >= 0) {
    const copy = [...blocks];
    copy[existing] = next;
    return copy;
  }
  return [...blocks, next];
}

export function remainingAfterSeen(total: number, seenCount: number): number {
  return Math.max(total - Math.max(seenCount, 0), 0);
}
