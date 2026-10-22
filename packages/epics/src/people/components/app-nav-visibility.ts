/**
 * App chrome (desktop profile nav + mobile tab bar) shows Messages and Spaces
 * for member/builder. Investors only get Home · Wallet · Network.
 */
export function shouldShowMessagesAndSpacesNav(
  orientation: string | null | undefined,
) {
  return orientation !== 'investor';
}

export function isMessagesOrSpacesNavHref(href: string | undefined) {
  if (!href) return false;
  return href.includes('/messages') || href.includes('/my-spaces');
}
