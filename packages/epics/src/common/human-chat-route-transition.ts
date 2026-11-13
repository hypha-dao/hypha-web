/**
 * Back on a space signal closes the panel first. Resetting to the space room
 * while the sidebar is still open is what made Back look like it opened the
 * space channel.
 */
export function shouldDelaySpaceSignalReset(input: {
  coherenceSlug: string | null | undefined;
  routeSpaceSlug: string | null | undefined;
  isConnectionsPage: boolean;
  sidebarOpen: boolean;
}): boolean {
  return (
    Boolean(input.coherenceSlug?.trim()) &&
    Boolean(input.routeSpaceSlug?.trim()) &&
    !input.isConnectionsPage &&
    input.sidebarOpen
  );
}

/**
 * A direct message opened in a space stays open on Home, Messages, Wallet,
 * My Spaces, and Network. Moving from one space to another still resets.
 * `onNetworkShell` is that set of pages (`isNetworkAiPath`).
 */
export function shouldPreserveDirectMessageOnSpaceLeave(input: {
  isDirectConversation: boolean;
  previousSpaceSlug: string | null;
  nextSpaceSlug: string | null;
  onNetworkShell: boolean;
}): boolean {
  if (!input.isDirectConversation) return false;
  if (!input.previousSpaceSlug) return false;
  if (input.nextSpaceSlug) return false;
  return input.onNetworkShell;
}
