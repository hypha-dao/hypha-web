/**
 * Messages stays in the app chrome for everyone except investors.
 * The spaces screen stays for everyone except investors and members.
 */
export function shouldShowMessagesNav(orientation: string | null | undefined) {
  return orientation !== 'investor';
}

export function shouldShowSpacesScreen(orientation: string | null | undefined) {
  return orientation !== 'investor' && orientation !== 'member';
}

export function isMessagesNavHref(href: string | undefined) {
  return Boolean(href?.includes('/messages'));
}

export function isSpacesNavHref(href: string | undefined) {
  return Boolean(href?.includes('/my-spaces'));
}
