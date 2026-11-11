/** Expand or collapse one message. Other ids stay as they are. */
export function toggleExpandedMessageId(
  expanded: ReadonlySet<string>,
  messageId: string,
): Set<string> {
  const id = messageId.trim();
  const next = new Set(expanded);
  if (!id) return next;
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
