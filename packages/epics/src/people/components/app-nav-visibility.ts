/**
 * Messages stays in the app chrome for every persona (including funders /
 * investors). The spaces screen stays for everyone except investors and members.
 */
export function shouldShowMessagesNav(_orientation: string | null | undefined) {
  return true;
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
