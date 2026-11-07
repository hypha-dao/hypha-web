/**
 * Leaving a signal page should close the right-panel chat only when that
 * panel is still the chat opened for this signal. A space chat or another
 * thread the member switched to stays open.
 */
export function shouldCloseSignalDetailChat(args: {
  mode: string | null | undefined;
  chatSlug: string | null | undefined;
  signalSlug: string | null | undefined;
}): boolean {
  const signalSlug = args.signalSlug?.trim() ?? '';
  if (!signalSlug) return false;
  if (args.mode !== 'coherence') return false;
  return (args.chatSlug?.trim() ?? '') === signalSlug;
}
