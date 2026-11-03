function firstName(value: string) {
  const token = value.trim().split(/\s+/)[0]?.replace(/,$/, '') ?? '';
  return token;
}

/** First name of the person on this chat. A space roster name does not belong here. */
export function directConversationWelcomeName({
  mode,
  coherenceSlug,
  coherenceTitle,
}: {
  mode: string;
  coherenceSlug?: string | null;
  coherenceTitle?: string | null;
}): string | null {
  if (mode !== 'coherence' || coherenceSlug?.trim()) return null;
  const title = coherenceTitle?.trim() ?? '';
  if (!title) return null;
  const names = title
    .split(',')
    .map((part) => firstName(part))
    .filter(Boolean);
  return names.join(', ') || null;
}

/**
 * Start-a-conversation copy is only for a room-less direct shell. After a
 * DM is bound, the empty timeline must not still say "Start a conversation".
 * Space chats with a welcome partner keep welcomeWith.
 */
export function directConversationEmptyWelcomeKey(input: {
  isDirectConversation: boolean;
  isStartConversation: boolean;
}): 'welcomeWith' | 'emptyDirectChat' {
  if (!input.isDirectConversation) return 'welcomeWith';
  return input.isStartConversation ? 'welcomeWith' : 'emptyDirectChat';
}
