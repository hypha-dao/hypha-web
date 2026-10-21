/**
 * A group chat is its own invite-only room. People only see it once they are
 * joined. An invite left sitting in Matrix never shows up in the people list.
 */
export function isAutoJoinGroupInvite({
  membership,
  canonicalAlias,
  roomName,
  creatorUserId,
  botUserId,
}: {
  membership: string | null | undefined;
  canonicalAlias: string | null | undefined;
  roomName: string | null | undefined;
  creatorUserId: string | null | undefined;
  botUserId: string | null | undefined;
}): boolean {
  if (membership !== 'invite') return false;
  if (canonicalAlias?.trim()) return false;
  const name = roomName?.trim() ?? '';
  if (!name.includes(',')) return false;
  const bot = botUserId?.trim();
  const creator = creatorUserId?.trim();
  if (!bot || !creator) return false;
  return creator === bot;
}
