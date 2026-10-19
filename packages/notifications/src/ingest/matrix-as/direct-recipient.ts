/**
 * The other human in a 1:1 room. Bots (the room owner and any extra AS bots) do not count.
 * Anything other than exactly two humans is not a private message.
 */
export function selectDirectRecipient(
  memberIds: readonly string[],
  senderMxid: string,
  botUserIds: ReadonlySet<string>,
): string | null {
  const sender = senderMxid.trim();
  if (!sender) return null;

  const humans = [
    ...new Set(
      memberIds
        .map((id) => id.trim())
        .filter((id) => Boolean(id) && !botUserIds.has(id)),
    ),
  ];
  if (humans.length !== 2 || !humans.includes(sender)) return null;
  return humans.find((id) => id !== sender) ?? null;
}
