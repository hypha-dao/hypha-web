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
